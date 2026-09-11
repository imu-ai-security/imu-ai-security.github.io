const GITHUB_CLIENT_ID = "Ov23li55OYhIAGsKSoX2";
const GITHUB_SCOPE = "public_repo";
const ALLOWED_ORIGINS = ["https://baibaoo.github.io", "http://localhost:4321"];

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });

const html = (body) =>
  new Response(body, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
      "referrer-policy": "no-referrer",
      "x-frame-options": "DENY",
    },
  });

function authPage() {
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>GitHub Login</title>
  <style>
    :root { color-scheme: light; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    body { margin: 0; padding: 32px; background: #f6f8fa; color: #24292f; }
    main { max-width: 560px; margin: 0 auto; background: #fff; border: 1px solid #d0d7de; border-radius: 12px; padding: 28px; box-shadow: 0 8px 24px rgba(140,149,159,.14); }
    h1 { margin: 0 0 12px; font-size: 24px; }
    p { line-height: 1.6; }
    code { display: block; margin: 18px 0; padding: 14px; background: #f6f8fa; border: 1px solid #d0d7de; border-radius: 8px; font-size: 28px; font-weight: 700; letter-spacing: .12em; text-align: center; }
    a { display: inline-block; margin-top: 8px; color: #0969da; font-weight: 600; }
    .error { color: #cf222e; }
  </style>
</head>
<body>
  <main>
    <h1>GitHub 登录</h1>
    <p id="status">正在获取登录码...</p>
    <code id="code" hidden></code>
    <a id="verify" href="#" target="_blank" rel="noopener" hidden>打开 GitHub 并输入代码</a>
  </main>
  <script>
    (async function () {
      var status = document.getElementById("status");
      var code = document.getElementById("code");
      var verify = document.getElementById("verify");
      try {
        var response = await fetch("/device", { method: "POST" });
        var device = await response.json();
        if (!response.ok || device.error) throw new Error(device.error_description || device.error || "无法获取登录码");
        code.textContent = device.user_code;
        code.hidden = false;
        verify.href = device.verification_uri;
        verify.hidden = false;
        status.textContent = "请打开 GitHub，输入下面的代码并确认授权：";
        var interval = (device.interval || 5) * 1000;
        async function poll() {
          var resultResponse = await fetch("/poll", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ device_code: device.device_code })
          });
          var result = await resultResponse.json();
          if (result.access_token) {
            authenticate(result.access_token);
            return;
          }
          if (result.error === "authorization_pending") {
            setTimeout(poll, interval);
            return;
          }
          if (result.error === "slow_down") {
            interval += 5000;
            setTimeout(poll, interval);
            return;
          }
          throw new Error(result.error_description || result.error || "授权失败");
        }
        setTimeout(poll, interval);
      } catch (error) {
        status.className = "error";
        status.textContent = "登录失败：" + error.message;
      }
    })();

    function authenticate(token) {
      var message = "authorization:github:success:" + JSON.stringify({ token: token, provider: "github" });
      function receiveMessage(event) {
        if (event.origin !== "https://baibaoo.github.io" && event.origin !== "http://localhost:4321") return;
        if (!window.opener) return;
        window.opener.postMessage(message, event.origin);
        window.close();
      }
      window.addEventListener("message", receiveMessage, false);
      if (window.opener) window.opener.postMessage("authorizing:github", "*");
    }
  </script>
</body>
</html>`;
}

async function githubDeviceCode() {
  const response = await fetch("https://github.com/login/device/code", {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      "user-agent": "baibaoo-cms-auth",
    },
    body: JSON.stringify({ client_id: GITHUB_CLIENT_ID, scope: GITHUB_SCOPE }),
  });
  return response.json();
}

async function githubToken(deviceCode) {
  const response = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      "user-agent": "baibaoo-cms-auth",
    },
    body: JSON.stringify({
      client_id: GITHUB_CLIENT_ID,
      device_code: deviceCode,
      grant_type: "urn:ietf:params:oauth:grant-type:device_code",
    }),
  });
  return response.json();
}

export default {
  async fetch(request) {
    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/auth") {
      return html(authPage());
    }

    if (request.method === "POST" && url.pathname === "/device") {
      return json(await githubDeviceCode());
    }

    if (request.method === "POST" && url.pathname === "/poll") {
      let body = {};
      try { body = await request.json(); } catch {}
      if (!body.device_code) return json({ error: "missing_device_code" }, 400);
      return json(await githubToken(body.device_code));
    }

    return new Response("baibaoo CMS auth worker is running.", {
      headers: {
        "content-type": "text/plain; charset=utf-8",
        "cache-control": "no-store",
      },
    });
  },
};