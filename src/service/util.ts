function buf2hex(buffer: ArrayBuffer): string { // buffer is an ArrayBuffer
    return [...new Uint8Array(buffer)]
        .map(x => x.toString(16).padStart(2, '0'))
        .join('');
}


async function str2sha256(str: string) {
    const encode = new TextEncoder().encode(str);

    const _digest = crypto.subtle.digest(
        {
            name: 'SHA-256',
        },
        encode // The data you want to hash as an ArrayBuffer
    )

    // to hex
    return buf2hex(await _digest)
}

// 生成 UserKey, 用于提供给用户和Tabby API，该算法提供的稳定性主要取决于 namespace_id
export function userKey(node_id: string, namespace_id: string): Promise<string> {
    return str2sha256(`${namespace_id}:${node_id}`);
}