export interface KVStore {

}

export class CloudflareKVStore implements KVStore {
    private kv: KVNamespace;
    private readonly ACCOUNTS_KEY = "accounts";

    constructor(kv: KVNamespace) {
        this.kv = kv;
    }
}
