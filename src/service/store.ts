import { z } from "zod";

export class SyncError extends Error {
	constructor(
		message: string,
		public readonly code: string,
		public readonly context?: Record<string, any>
	) {
		super(message);
		this.name = 'SyncError';
	}
}

export interface DataStore<T> {
	create(entity: Omit<T, 'id'>): Promise<T>
	findById(id: number): Promise<T | null>
	findBy(field: keyof T, value: any): Promise<T[]>
	findAll(): Promise<T[]>
	update(id: number, updates: Partial<T>): Promise<T | null>
	delete(id: number): Promise<boolean>
}

export interface PaginationOptions {
	limit?: number;
	offset?: number;
}

export interface QueryResult<T> {
	data: T[];
	total: number;
	hasMore: boolean;
}

export class CloudflareKVStore<T> implements DataStore<T> {
	constructor(
		private kv: KVNamespace,
		private keyPrefix: string,
		private schema: z.ZodSchema<T>,
		private listKey: string
	) {}

	private generateKey(id: number): string {
		return `${this.keyPrefix}:${id}`;
	}

	private async getNextId(): Promise<number> {
		const counterKey = `${this.keyPrefix}:counter`;
		const currentId = await this.kv.get(counterKey);
		const nextId = currentId ? parseInt(currentId) + 1 : 1;
		await this.kv.put(counterKey, nextId.toString());
		return nextId;
	}

	private async getList(): Promise<{ items: T[], maxId: number }> {
		const listData = await this.kv.get(this.listKey, { type: "json" });
		if (!listData) {
			return { items: [], maxId: 0 };
		}
		
		const validatedItems = (listData as any[]).map(item => this.schema.parse(item));
		const maxId = validatedItems.reduce((max, item: any) => Math.max(max, item.id || 0), 0);
		
		return { items: validatedItems, maxId };
	}

	private async updateList(items: T[]): Promise<void> {
		await this.kv.put(this.listKey, JSON.stringify(items));
	}

	async create(entity: Omit<T, 'id'>): Promise<T> {
		try {
			const { items } = await this.getList();
			const id = await this.getNextId();
			
			const newEntity = { ...entity, id } as T;
			const validatedEntity = this.schema.parse(newEntity);
			
			items.push(validatedEntity);
			await this.updateList(items);
			
			await this.kv.put(this.generateKey(id), JSON.stringify(validatedEntity));
			
			return validatedEntity;
		} catch (error) {
			throw new SyncError(
				`Failed to create entity: ${error instanceof Error ? error.message : 'Unknown error'}`,
				'CREATE_ERROR',
				{ entity }
			);
		}
	}

	async findById(id: number): Promise<T | null> {
		try {
			const entityData = await this.kv.get(this.generateKey(id), { type: "json" });
			if (!entityData) return null;
			
			return this.schema.parse(entityData);
		} catch (error) {
			throw new SyncError(
				`Failed to find entity by id: ${error instanceof Error ? error.message : 'Unknown error'}`,
				'FIND_ERROR',
				{ id }
			);
		}
	}

	async findBy(field: keyof T, value: any): Promise<T[]> {
		try {
			const { items } = await this.getList();
			return items.filter(item => (item as any)[field] === value);
		} catch (error) {
			throw new SyncError(
				`Failed to find entities by field: ${error instanceof Error ? error.message : 'Unknown error'}`,
				'FIND_ERROR',
				{ field, value }
			);
		}
	}

	async findAll(options?: PaginationOptions): Promise<T[]> {
		try {
			const { items } = await this.getList();
			
			if (!options) return items;
			
			const { limit, offset = 0 } = options;
			const start = offset;
			const end = limit ? offset + limit : undefined;
			
			return items.slice(start, end);
		} catch (error) {
			throw new SyncError(
				`Failed to find all entities: ${error instanceof Error ? error.message : 'Unknown error'}`,
				'FIND_ERROR',
				{ options }
			);
		}
	}

	async update(id: number, updates: Partial<T>): Promise<T | null> {
		try {
			const currentEntity = await this.findById(id);
			if (!currentEntity) return null;
			
			const updatedEntity = { ...currentEntity, ...updates } as T;
			const validatedEntity = this.schema.parse(updatedEntity);
			
			const { items } = await this.getList();
			const index = items.findIndex(item => (item as any).id === id);
			
			if (index !== -1) {
				items[index] = validatedEntity;
				await this.updateList(items);
			}
			
			await this.kv.put(this.generateKey(id), JSON.stringify(validatedEntity));
			
			return validatedEntity;
		} catch (error) {
			throw new SyncError(
				`Failed to update entity: ${error instanceof Error ? error.message : 'Unknown error'}`,
				'UPDATE_ERROR',
				{ id, updates }
			);
		}
	}

	async delete(id: number): Promise<boolean> {
		try {
			const currentEntity = await this.findById(id);
			if (!currentEntity) return false;
			
			const { items } = await this.getList();
			const filteredItems = items.filter(item => (item as any).id !== id);
			
			await this.updateList(filteredItems);
			await this.kv.delete(this.generateKey(id));
			
			return true;
		} catch (error) {
			throw new SyncError(
				`Failed to delete entity: ${error instanceof Error ? error.message : 'Unknown error'}`,
				'DELETE_ERROR',
				{ id }
			);
		}
	}

	async query(options: {
		where?: Partial<T>;
		pagination?: PaginationOptions;
		orderBy?: keyof T;
		order?: 'asc' | 'desc';
	}): Promise<QueryResult<T>> {
		try {
			const { items } = await this.getList();
			let filteredItems = items;
			
			if (options.where) {
				filteredItems = items.filter(item => {
					return Object.entries(options.where!).every(([key, value]) => {
						return (item as any)[key] === value;
					});
				});
			}
			
			if (options.orderBy) {
				filteredItems.sort((a, b) => {
					const aVal = (a as any)[options.orderBy!];
					const bVal = (b as any)[options.orderBy!];
					
					if (options.order === 'desc') {
						return bVal > aVal ? 1 : -1;
					}
					return aVal > bVal ? 1 : -1;
				});
			}
			
			const total = filteredItems.length;
			const { limit, offset = 0 } = options.pagination || {};
			
			let paginatedItems = filteredItems;
			if (offset || limit) {
				const start = offset || 0;
				const end = limit ? offset + limit : undefined;
				paginatedItems = filteredItems.slice(start, end);
			}
			
			return {
				data: paginatedItems,
				total,
				hasMore: limit ? offset + limit < total : false
			};
		} catch (error) {
			throw new SyncError(
				`Failed to query entities: ${error instanceof Error ? error.message : 'Unknown error'}`,
				'QUERY_ERROR',
				{ options }
			);
		}
	}
}

export class EventManager {
	private listeners = new Map<string, Function[]>();

	on(event: string, handler: Function): void {
		const handlers = this.listeners.get(event) || [];
		handlers.push(handler);
		this.listeners.set(event, handlers);
	}

	off(event: string, handler: Function): void {
		const handlers = this.listeners.get(event) || [];
		const index = handlers.indexOf(handler);
		if (index !== -1) {
			handlers.splice(index, 1);
		}
	}

	emit(event: string, data: any): void {
		const handlers = this.listeners.get(event) || [];
		handlers.forEach(handler => {
			try {
				handler(data);
			} catch (error) {
				console.error(`Error in event handler for ${event}:`, error);
			}
		});
	}
}

export const globalEventManager = new EventManager();