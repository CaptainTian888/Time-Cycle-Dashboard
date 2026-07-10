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
├── index.html      # 主页面（含全部 CSS + JS）
├── data.json       # 项目数据（静态数据源）
├── README.md       # 本文件
└── .gitignore      # Git 忽略规则
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

#### 第三步：在看板中配置部署设置

1. 打开看板页面，输入密码进入
2. 点击右上角 **「部署设置」** 按钮
3. 填写 GitHub 仓库信息：
   - **GitHub 用户名**: 你的 GitHub 用户名
   - **仓库名称**: 仓库名
   - **分支名称**: `main`（默认）
   - **数据文件路径**: `data.json`（默认）
   - **访问令牌**: GitHub Personal Access Token
4. 点击 **「测试连接」** 验证配置
5. 点击 **「保存设置」**

#### 创建 GitHub Personal Access Token

1. 访问 [GitHub Settings → Tokens](https://github.com/settings/tokens/new?scopes=repo&description=Time-Cycle-Dashboard)
2. 勾选 **`repo`** 权限（完整仓库访问）
3. 点击 **Generate token**
4. 复制生成的 token（格式：`ghp_xxxxx...`）
5. 粘贴到看板的部署设置中

> 令牌仅保存在本地浏览器 localStorage，不会上传到任何第三方服务器。

## 自动部署流程

```
用户编辑数据 → 点击保存 → 数据写入 localStorage
                         ↓
               GitHub API 提交 data.json
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
- GitHub Contents API（数据同步）
- CloudFlare Pages（静态托管）
- Web Crypto API（AES-256-GCM 加密 + PBKDF2 密钥派生）
- localStorage（本地缓存）

## License

Private
