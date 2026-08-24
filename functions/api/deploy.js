/**
 * Cloudflare Pages Function — /api/deploy
 *
 * 代理前端的「保存 → 提交 data.json」请求，把 GitHub Token 收进服务端环境变量，
 * 浏览器再也拿不到它。
 *
 * 需要在 Cloudflare Pages → Settings → Variables and Secrets 配置：
 *   GITHUB_TOKEN       (Secret)  具备本仓库 Contents: write 权限的 GitHub Token
 *   DEPLOY_AUTH_HASH   (Secret)  客户端 auth token 的 SHA-256（十六进制小写）
 *
 * 可选覆盖（不配则用下面的默认值）：
 *   GH_OWNER / GH_REPO / GH_BRANCH / GH_PATH
 */

const DEFAULTS = {
    owner: 'CaptainTian888',
    repo: 'Time-Cycle-Dashboard',
    branch: 'main',
    path: 'data.json'
};

const MAX_CONTENT_BYTES = 2 * 1024 * 1024; // 2 MB 上限，防止被当成任意写入接口滥用

function json(body, status = 200) {
    return new Response(JSON.stringify(body), {
        status,
        headers: {
            'Content-Type': 'application/json; charset=utf-8',
            'Cache-Control': 'no-store'
        }
    });
}

/** UTF-8 字符串 → base64（分块，避免大内容时 spread 撑爆调用栈） */
function toBase64(str) {
    const bytes = new TextEncoder().encode(str);
    let binary = '';
    const CHUNK = 0x8000;
    for (let i = 0; i < bytes.length; i += CHUNK) {
        binary += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
    }
    return btoa(binary);
}

async function sha256Hex(str) {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
    return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
}

/** 定长比较，避免按字节提前返回导致的时序泄漏 */
function timingSafeEqual(a, b) {
    if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
    let diff = 0;
    for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
    return diff === 0;
}

export async function onRequestPost({ request, env }) {
    if (!env.GITHUB_TOKEN || !env.DEPLOY_AUTH_HASH) {
        return json({ error: '服务端未配置 GITHUB_TOKEN / DEPLOY_AUTH_HASH' }, 500);
    }

    // ─── 鉴权 ─── //
    const auth = request.headers.get('X-Deploy-Auth') || '';
    if (!auth) return json({ error: '缺少鉴权头' }, 401);

    const expected = env.DEPLOY_AUTH_HASH.trim().toLowerCase();
    if (!timingSafeEqual(await sha256Hex(auth), expected)) {
        return json({ error: '鉴权失败' }, 401);
    }

    // ─── 请求体校验 ─── //
    let body;
    try {
        body = await request.json();
    } catch {
        return json({ error: '请求体不是合法 JSON' }, 400);
    }

    const content = body && body.content;
    if (typeof content !== 'string' || !content) {
        return json({ error: '缺少 content 字段' }, 400);
    }
    if (new TextEncoder().encode(content).length > MAX_CONTENT_BYTES) {
        return json({ error: '内容超过 2MB 上限' }, 413);
    }

    // 只接受本看板的加密数据结构，避免这个接口被拿去写任意文件内容
    let parsed;
    try {
        parsed = JSON.parse(content);
    } catch {
        return json({ error: 'content 不是合法 JSON' }, 400);
    }
    if (!parsed || typeof parsed.salt !== 'string' || typeof parsed.iv !== 'string' || typeof parsed.data !== 'string') {
        return json({ error: 'content 不是合法的加密数据（需含 salt / iv / data）' }, 400);
    }

    const owner = env.GH_OWNER || DEFAULTS.owner;
    const repo = env.GH_REPO || DEFAULTS.repo;
    const branch = env.GH_BRANCH || DEFAULTS.branch;
    const path = env.GH_PATH || DEFAULTS.path;

    const ghHeaders = {
        'Authorization': `Bearer ${env.GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'time-cycle-dashboard'
    };

    // ─── 取当前文件 SHA ─── //
    let sha = null;
    try {
        const getResp = await fetch(
            `https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${branch}`,
            { headers: ghHeaders }
        );
        if (getResp.ok) {
            sha = (await getResp.json()).sha;
        } else if (getResp.status === 401 || getResp.status === 403) {
            return json({ error: `GitHub 拒绝了服务端 Token（${getResp.status}），请检查 GITHUB_TOKEN` }, 502);
        }
        // 404 = 文件还不存在，走新建流程
    } catch (e) {
        return json({ error: `读取 GitHub 文件失败：${e.message}` }, 502);
    }

    // ─── 提交 ─── //
    const putBody = {
        message: `Auto-deploy: Update ${path} (${new Date().toISOString()})`,
        content: toBase64(content),
        branch,
        committer: { name: 'Time Dashboard', email: 'dashboard@users.noreply.github.com' }
    };
    if (sha) putBody.sha = sha;

    let putResp;
    try {
        putResp = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${path}`, {
            method: 'PUT',
            headers: { ...ghHeaders, 'Content-Type': 'application/json' },
            body: JSON.stringify(putBody)
        });
    } catch (e) {
        return json({ error: `提交 GitHub 失败：${e.message}` }, 502);
    }

    if (!putResp.ok) {
        const err = await putResp.json().catch(() => ({}));
        return json({ error: err.message || `GitHub 返回 ${putResp.status}` }, 502);
    }

    const result = await putResp.json().catch(() => ({}));
    return json({ ok: true, commit: result.commit && result.commit.sha });
}
