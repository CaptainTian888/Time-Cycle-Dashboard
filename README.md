# Time Cycle Dashboard

时间周期看板 - 静态部署版本，支持 GitHub 托管 + CloudFlare Pages 自动部署。

## 功能特性

- **密码保护** - 访问页面需输入密码，密码同时作为 AES-256-GCM 数据加密密钥
- **数据加密** - 所有项目数据使用 AES-256-GCM + PBKDF2 加密存储，即使仓库公开也无法看到明文
- **静态部署** - 纯前端，无需后端服务器
- **自动部署** - 编辑后点击保存，自动通过 GitHub API 提交数据，CloudFlare Pages 自动构建
- **时间看板** - 支持年/月/周/日四种视图的时间轴可视化
- **分类管理** - 自定义分类标签与颜色
- **数据导入/导出** - JSON 格式备份
- **明暗主题** - 支持浅色/深色切换
- **响应式布局** - 适配桌面与移动端

## 文件结构

```
Time-Cycle-Dashboard/
├── index.html              # 主页面（含全部 CSS + JS）
├── data.json               # 项目数据（静态数据源）
├── functions/
│   └── api/
│       └── deploy.js       # Pages Function：代理写回 data.json，持有 GitHub Token
├── README.md               # 本文件
└── .gitignore              # Git 忽略规则
```

## 快速开始

### 本地预览

```bash
# 使用 Python 启动本地服务器
python -m http.server 8080

# 或使用 Node.js
npx serve .
```

浏览器访问 `http://localhost:8080`，输入密码即可进入。

### 部署到 GitHub + CloudFlare Pages

#### 第一步：推送到 GitHub

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/<你的用户名>/<仓库名>.git
git push -u origin main
```

#### 第二步：配置 CloudFlare Pages

1. 登录 [CloudFlare Dashboard](https://dash.cloudflare.com/)
2. 进入 **Workers & Pages** → **Create application** → **Pages**
3. 选择 **Connect to Git**
4. 授权并选择你的 GitHub 仓库
5. 构建配置：
   - **Framework preset**: `None`
   - **Build command**: 留空
   - **Build output directory**: `/`（根目录）
   - **Root directory**: 留空
6. 点击 **Save and Deploy**

部署完成后，CloudFlare 会分配一个 `*.pages.dev` 域名，也可绑定自定义域名。

#### 第三步：创建 GitHub Token

1. 访问 [GitHub Settings → Fine-grained tokens](https://github.com/settings/personal-access-tokens/new)
2. **Repository access** 只勾选本仓库
3. **Permissions → Repository permissions → Contents** 选 **Read and write**（只需要这一项）
4. 有效期按需设置；到期前记得轮换
5. 生成后复制备用（下一步填进 Cloudflare，**不要写进代码**）

#### 第四步：配置 Cloudflare 环境变量

进入 Pages 项目 → **Settings** → **Variables and Secrets**，添加两个 **Secret**：

| 变量名 | 值 |
| --- | --- |
| `GITHUB_TOKEN` | 上一步生成的 Token |
| `DEPLOY_AUTH_HASH` | 见下方获取方式 |

获取 `DEPLOY_AUTH_HASH`：打开看板页面并用密码登录，按 F12 打开浏览器控制台，执行

```js
await printDeployAuthHash()
```

复制打印出的 64 位十六进制字符串填入即可。

> 这个哈希是由登录密码经 PBKDF2（20 万次迭代、独立 salt）派生后再做一次 SHA-256 得到的。
> 服务端只保存哈希，既反推不出密码，也解不开 `data.json`；换密码后需要重新执行上面这行取新值。

可选变量（不配则使用 `functions/api/deploy.js` 里的默认值）：`GH_OWNER`、`GH_REPO`、`GH_BRANCH`、`GH_PATH`。

> **注意**：GitHub Token 只存在于 Cloudflare 服务端环境变量中，浏览器永远拿不到它。
> 不要把 Token 以任何形式（包括混淆、编码）写进 `index.html` —— 静态页面对所有访客可读。

## 自动部署流程

```
用户编辑数据 → 点击保存 → 数据写入 localStorage
                         ↓
               本地加密 + 由密码派生鉴权令牌
                         ↓
               POST /api/deploy（同源 Pages Function）
                         ↓
               Function 校验令牌 → 用服务端 Token 调 GitHub API 提交 data.json
                         ↓
               GitHub 仓库更新 → 触发 CloudFlare Pages 构建
                         ↓
               1-2 分钟后 CloudFlare 站点更新
```

- 每次保存后，数据会自动同步到 GitHub
- 防抖设计：连续编辑只触发一次部署
- 部署状态通过 Toast 通知反馈

## 数据格式

```json
{
  "projects": [
    {
      "id": "唯一ID",
      "name": "项目名称",
      "category": "分类ID",
      "start": "2025-03-10",
      "days": 365,
      "end": "2026-03-10",
      "notes": "备注信息"
    }
  ],
  "categories": [
    {
      "id": "cat_xxx",
      "name": "分类名称",
      "color": "#4f86f7"
    }
  ]
}
```

## 技术栈

- 纯 HTML / CSS / JavaScript（零依赖）
- GitHub Contents API（数据同步，经服务端代理调用）
- CloudFlare Pages（静态托管）+ Pages Functions（部署代理）
- Web Crypto API（AES-256-GCM 加密 + PBKDF2 密钥派生）
- localStorage（本地缓存）

## License

Private
