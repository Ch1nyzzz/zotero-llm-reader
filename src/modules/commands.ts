export async function actionGenerateRichAndOpen() {
  // 提示用户使用侧边栏
  const pw = new ztoolkit.ProgressWindow(addon.data.config.addonName);
  pw.createLine({
    text: "请在 PDF 阅读器侧边栏中查看 LLM Reader 面板",
    type: "default",
  }).show();
  pw.startCloseTimer(3000);
}
