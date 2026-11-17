# B站接口诊断 V2

用于在小火箭中短暂采集 B站接口结构，协助排查首页、视频下方推荐与竖屏流广告。仅诊断，不提供广告过滤。

## 文件

- `bili_diag_v2.js`：诊断脚本。
- `bili_diag_v2.srmodule`：填写当前仓库脚本地址后的可安装模块。
- `安装与短测说明-V2.md`：安装、已知接口验证、App 短测和回退步骤。

## 使用

将 [诊断模块地址](https://raw.githubusercontent.com/hnxylanan-design/bili-diag/main/bili_diag_v2.srmodule) 添加到小火箭的模块中，暂时关闭其他 B站模块。先用 Safari 打开 `https://api.bilibili.com/x/web-interface/nav`，确认日志同时出现 `phase=request` 与 `phase=response`，再短测首页、视频下方推荐和竖屏流 1～2 分钟。采集完成后关闭本模块，恢复原来的模块。

详细步骤见 [安装与短测说明-V2.md](安装与短测说明-V2.md)。

## 限制

日志只输出接口路径与有限结构，不输出查询参数、请求头、Cookie、视频标题或账号字段值；脚本不主动上传日志、不写入存储。每次均以 `$done({})` 放行。protobuf 仅记录结构，尚未完整解码业务协议，未发现字段不能证明没有广告。

尚未在使用者的 iPhone、小火箭版本和 B站客户端上实测。
