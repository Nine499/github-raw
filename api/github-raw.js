// 导出默认的异步函数，处理HTTP请求
export default async function handler(request, response) {
  try {
    // 从环境变量中获取预设的token值
    const NINE49TOKEN = process.env.NINE49TOKEN;
    const GITHUB49TOKEN = process.env.GITHUB49TOKEN;
    // 从请求查询参数中获取用户提供的token
    const userToken = request.query["nine-token"];
    // 从请求查询参数中获取GitHub路径
    const githubPath = request.query.path;
    // 验证用户提供的token是否与环境变量中的NINE49TOKEN匹配
    if (!userToken || userToken !== NINE49TOKEN) {
      // 如果token不匹配或不存在，重定向到百度
      response.redirect("https://www.baidu.com");
      return;
    }
    // 检查是否提供了GitHub路径
    if (!githubPath) {
      // 如果没有提供路径，重定向到百度
      response.redirect("https://www.baidu.com");
      return;
    }
    // 构建GitHub原始内容URL
    const githubRawUrl = `https://raw.githubusercontent.com/${githubPath}`;
    // 发起请求到GitHub原始内容URL，并添加Authorization头
    const githubResponse = await fetch(githubRawUrl, {
      headers: {
        // 添加GitHub token到Authorization头
        Authorization: `Bearer ${GITHUB49TOKEN}`,
      },
    });
    // 检查GitHub响应状态
    if (!githubResponse.ok) {
      // 如果GitHub返回错误状态，重定向到百度
      response.redirect("https://www.baidu.com");
      return;
    }
    // 获取GitHub响应的内容类型和内容
    const contentType = githubResponse.headers.get("content-type");
    const content = await githubResponse.text();
    // 设置响应头，将GitHub的内容类型传递给客户端
    if (contentType) {
      response.setHeader("Content-Type", contentType);
    }
    // 将GitHub的内容返回给用户
    response.status(200).send(content);
  } catch (error) {
    // 记录错误日志（在Vercel日志中可见）
    console.error("处理请求时发生错误:", error);
    // 发生任何错误时重定向到百度
    response.redirect("https://www.baidu.com");
  }
}
