# 待办事项



- [x] 暂时封存好奇心，直接设为0，现在我们要可控观察ai成长

- [x] 神经元区域的菜单可以挪到顶部菜单栏右上

- [ ] 代码重构：NeuronAreaManager 高亮方法合并
  - updateModeHighlight 和 updateSpeedHighlight 几乎相同，可合并为通用方法
  - 考虑提取通用的菜单项创建函数



- [ ] 规范项目日志输出：使用 game-log-*.txt 命名格式
  - 当前问题：日志文件命名混乱（console-*.txt、debug-*.log.txt 等）
  - 目标：统一使用 game-log-*.txt，与 view-media 技能匹配

- [ ] 清理重复 skill：删除所有子目录 .kimi/skills/ 通用技能
  - 检查并列出重复项（如 view-media、commit-assistant 等）
  - 全部移到 html 根统一管理
  - 确保工作区内无重复 skill





