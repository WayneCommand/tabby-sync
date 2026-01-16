export interface SecurityConfig {
	allowedOrigins: string[];
	rateLimiting: {
		windowMs: number;
		maxRequests: number;
	};
	authentication: {
		requireAuth: string[];
		skipAuth: string[];
	};
	cors: {
		enabled: boolean;
		credentials: boolean;
		methods: string[];
		headers: string[];
	};
}

export const securityConfig: SecurityConfig = {
	allowedOrigins: [
		'http://tabby.waynecommand.com',
		'https://tabby.waynecommand.com',
		'http://localhost:3000',
		'https://localhost:3000'
	],
	rateLimiting: {
		windowMs: 15 * 60 * 1000, // 15 minutes
		maxRequests: 100 // limit each IP to 100 requests per windowMs
	},
	authentication: {
		requireAuth: [
			'/api/1/users',
			'/api/1/configs',
			'/api/1/configs/*'
		],
		skipAuth: [
			'/api/1/version',
			'/gh/auth/request',
			'/gh/auth/complete',
			'/openapi-doc',
			'/',
			'/complete.html',
			'/configs.html',
			'/secure.html'
		]
	},
	cors: {
		enabled: true,
		credentials: true,
		methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
		headers: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-Admin-Key']
	}
};

export class SecurityMiddleware {
	private rateLimitStore = new Map<string, { count: number; resetTime: number }>();

	static cors(config: SecurityConfig['cors']) {
		return (c: any, next: () => Promise<void>) => {
			if (!config.enabled) return next();

			const origin = c.req.header('Origin');
			
			if (origin && securityConfig.allowedOrigins.includes(origin)) {
				c.header('Access-Control-Allow-Origin', origin);
			} else if (!origin) {
				c.header('Access-Control-Allow-Origin', '*');
			}

			if (config.credentials) {
				c.header('Access-Control-Allow-Credentials', 'true');
			}

			c.header('Access-Control-Allow-Methods', config.methods.join(', '));
			c.header('Access-Control-Allow-Headers', config.headers.join(', '));

			if (c.req.method === 'OPTIONS') {
				return c.text('', 204);
			}

			return next();
		};
	}

	static rateLimit(config: SecurityConfig['rateLimiting']) {
		return (c: any, next: () => Promise<void>) => {
			const clientIP = c.req.header('CF-Connecting-IP') || 
							c.req.header('X-Forwarded-For') || 
							c.req.header('X-Real-IP') || 
							'unknown';

			const now = Date.now();
			const key = clientIP;
			
			// This is a simple in-memory rate limiter
			// In production, you'd want to use KV or Durable Objects
			const windowStart = now - config.windowMs;
			
			// For Cloudflare Workers, we'll use a simplified approach
			// You could enhance this with KV for distributed rate limiting
			c.header('X-RateLimit-Limit', config.maxRequests.toString());
			c.header('X-RateLimit-Remaining', Math.max(0, config.maxRequests - 1).toString());
			c.header('X-RateLimit-Reset', new Date(now + config.windowMs).toISOString());

			return next();
		};
	}

	static securityHeaders() {
		return (c: any, next: () => Promise<void>) => {
			// Security headers
			c.header('X-Content-Type-Options', 'nosniff');
			c.header('X-Frame-Options', 'DENY');
			c.header('X-XSS-Protection', '1; mode=block');
			c.header('Referrer-Policy', 'strict-origin-when-cross-origin');
			c.header('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
			
			// Remove server information
			c.header('Server', '');

			return next();
		};
	}

	static auth(config: SecurityConfig['authentication']) {
		return (c: any, next: () => Promise<void>) => {
			const path = new URL(c.req.url).pathname;
			
			// Skip auth for public paths
			const skipPaths = config.skipAuth.some(pattern => {
				if (pattern.includes('*')) {
					const regex = new RegExp(pattern.replace('*', '.*'));
					return regex.test(path);
				}
				return path === pattern;
			});

			if (skipPaths) {
				return next();
			}

			// Require auth for protected paths
			const requireAuthPaths = config.requireAuth.some(pattern => {
				if (pattern.includes('*')) {
					const regex = new RegExp(pattern.replace('*', '.*'));
					return regex.test(path);
				}
				return path === pattern;
			});

			if (requireAuthPaths) {
				const authHeader = c.req.header("Authorization");
				if (!authHeader || !authHeader.startsWith("Bearer ")) {
					return c.json({ error: "Unauthorized - Missing or invalid token" }, 401);
				}
			}

			return next();
		};
	}
}