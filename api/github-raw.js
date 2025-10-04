const { NINE49TOKEN, GITHUB49TOKEN } = process.env;
const REDIRECT_URL = "https://www.baidu.com";

export default async function handler(request, response) {
  try {
    const { "nine-token": userToken, path: githubPath } = request.query;

    // 一次性验证所有条件
    if (userToken !== NINE49TOKEN || !githubPath) {
      return response.redirect(REDIRECT_URL);
    }

    // 获取GitHub内容
    const githubUrl = `https://raw.githubusercontent.com/${githubPath}`;
    const githubResponse = await fetch(githubUrl, {
      headers: { Authorization: `Bearer ${GITHUB49TOKEN}` },
    });

    if (!githubResponse.ok) {
      return response.redirect(REDIRECT_URL);
    }

    // 返回内容
    const contentType = githubResponse.headers.get("content-type");
    const content = await githubResponse.text();

    if (contentType) response.setHeader("Content-Type", contentType);
    return response.status(200).send(content);
  } catch (error) {
    console.error("处理请求时发生错误:", error);
    return response.redirect(REDIRECT_URL);
  }
}
