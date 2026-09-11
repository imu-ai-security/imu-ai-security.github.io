# 内蒙古大学人工智能安全实验室网站

这是一个基于 Astro 与 Tailwind CSS 的内容驱动型实验室网站模板，已预填内蒙古大学人工智能安全实验室的示例内容。网站支持 GitHub Pages 部署，内容主要通过 `src/content/` 下的 Markdown 文件维护。

## 本地运行

```bash
npm install
npm run dev        # http://localhost:4321
```

常用命令：

| 命令 | 作用 |
| --- | --- |
| `npm run dev` | 启动开发服务器 |
| `npm run build` | 构建生产版本到 `dist/` |
| `npm run preview` | 预览生产构建 |
| `npx astro check` | 检查 Astro 文件和内容数据 |

## 目录结构

```text
src/
  content/              团队成员、论文、图表、实验室生活照片
  content.config.ts     内容集合 schema 与研究分类
  data/site.ts          实验室名称、联系方式、导航和社交链接
  lib/content.ts        研究分类标签及查询函数
  components/           页面布局和可复用组件
  pages/                首页及各栏目路由
public/                 favicon、robots.txt 等静态文件
scripts/                引用计数、ORCID 补全等可选脚本
```

## 修改内容

- 团队成员：在 `src/content/people/` 新增或编辑 Markdown。文件名就是个人页面 URL 的 slug。
- 论文成果：在 `src/content/publications/` 添加论文，frontmatter 必须符合 `src/content.config.ts`。
- 研究图表：在 `src/content/figures/` 添加图片和图注；只有 `rightsConfirmed: true` 的条目会显示。
- 实验室生活：在 `src/content/gallery/` 添加图片、日期和说明，页面支持按年份筛选。
- 网站身份：编辑 `src/data/site.ts` 更新名称、电话、邮箱、地址、GitHub 和导航。

## 部署

请参考 `SETUP.md` 配置 GitHub Pages。推送到默认分支后，GitHub Actions 会自动构建和发布。

## 版权提示

仓库中的图片目前是从公开图片服务下载的占位素材，仅用于演示。正式上线前请替换为实验室拥有使用权的照片、头像和研究图表，并确认图表的授权信息。

本项目沿用 MIT 许可证。
