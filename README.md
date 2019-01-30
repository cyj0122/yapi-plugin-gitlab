#yapi-plugin-gitlab

gitlab集成插件，配置方法如下：

### 配置

第一步：在gitlab中配置oauth2, 生成appId、secret。

![gitlab setting1](https://github.com/cyj0122/docImages/blob/master/yapi-plugin-gitlab/gitlab-oauth-setting.png)

第一步：在生成的配置文件config.json中加入如下配置

```json
"plugins": [{
    "name": "gitlab",
    "options": {
        "host" : "http://gitlab.example.com:port",
        "redirectUri" : "http://yapi.example.com:3000/api/plugin/oauth2/callback",
        "appId" : "xxxxxxxxxxxxxxxxxx",
        "appSecret" : "xxxxxxxxxxxxxxxxxxxxxx",
        "accessToken": "xxxxxxxxxxxxxxxxxxxxxxxx",
        "loginPath": "/api/v4/user",
        "authPath" : "/oauth/authorize",
        "tokenPath" : "/oauth/token",
        "emailKey" : "email",
        "userKey" : "username",
        "emailPostfix" : "@yapi.com"
    }
}]
```
