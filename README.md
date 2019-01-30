# yapi-plugin-gitlab

gitlab集成插件，配置方法如下：

### 功能说明

1. 提供gitlab oauth2登录

2. 提供项目创建接口，配置gitlab的system hooks,可同步生成工程。

3. 提供yapi与gitlab分组成员同步接口

4. 提供yapi与gitlab项目成员同步接口

### 配置

第一步：在gitlab中配置oauth2, 生成appId、secret。

![gitlab setting1](https://github.com/cyj0122/docImages/blob/master/yapi-plugin-gitlab/gitlab-oauth-setting.png)

第二步：在gitlab中配置access-token

![gitlab setting2](https://github.com/cyj0122/docImages/blob/master/yapi-plugin-gitlab/gitlab-accesstoken-setting.png)

第三步：在生成的配置文件config.json中加入如下配置

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
配置含义如下：

- `host` gitlab部署地址
- `redirectUri` oauth2回调地址
- `appId` 第一步中gitlab生成的Application ID
- `appSecret` 第一步中gitlab生成的Secret
- `loginPath`、`authPath`、`tokenPath` oauth2基本配置（一般无需修改，直接复制）
- `emailKey` gitlab用户信息邮箱关键字
- `userKey` gitlab用户信息用户名关键字
- `emailPostfix` 如果gitlab用户没有邮箱信息在yapi中，已gitlab用户名+该后缀作为邮箱地址

### 效果图示

![yapi login](https://github.com/cyj0122/docImages/blob/master/yapi-plugin-gitlab/yapi-gitlab-login.png)

![yapi group async](https://github.com/cyj0122/docImages/blob/master/yapi-plugin-gitlab/yapi-gitlab-gourpasync.png)

![yapi project async](https://github.com/cyj0122/docImages/blob/master/yapi-plugin-gitlab/yapi-gitlab-projectasync.png)