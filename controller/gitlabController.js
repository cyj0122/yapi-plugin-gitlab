const yapi = require("yapi.js");
const baseController = require("controllers/base.js");
const request = require("request");
const userModel = require("models/user.js");
const projectModel = require("models/project.js");
const interfaceColModel = require("models/interfaceCol.js");
const interfaceCatModel = require("models/interfaceCat.js");
const groupModel = require("models/group.js");

class gitlabController extends baseController{
    constructor(ctx) {
        super(ctx);
        // 给group添加通过名称查询的方法
        groupModel.prototype.getByName = function (groupName) {
            return this.model
                .findOne({
                    group_name: groupName
                }).exec();
        };
        // 覆盖所有members
        groupModel.prototype.updateAll = function (data) {
            return this.model.updateOne(
                {
                    "_id": data._id
                },
                {
                    $set: {
                        "members": data.members
                    }
                },
                { multi: true }
            );
        };
        projectModel.prototype.updateAll = function (data) {
            return this.model.updateOne(
                {
                    "_id": data._id
                },
                {
                    $set: {
                        "members": data.members
                    }
                },
                { multi: true }
            );
        };
        this.groupModel = yapi.getInst(groupModel);
        this.projectModel = yapi.getInst(projectModel);
    }

    async init(ctx) {
        let ops = this.getOptions();
        if (ctx.request.header.oauth_token) {
            let result = await this.getGitLabUser(ops, ctx.request.header.oauth_token);
            this.$auth = true;
            this.$user = await this.handleThirdLogin(result.email, result.username);
            this.$uid = this.$user._id;
        } else if (ctx.request.header["x-gitlab-event"] && ctx.request.header["x-gitlab-event"] === "System Hook" && ctx.request.body.event_name === "project_create") {
            let project = await this.searchGitLabProjectById(ops, ctx.request.body.project_id);
            let result = await this.searchGitLabUserById(ops, project.creator_id);
            this.$auth = true;
            this.$user = await this.handleThirdLogin(result.email, result.username);
            this.$uid = this.$user._id;
        } else {
            await super.init(ctx);
        }
    }

    /**
     * 创建项目对外接口
     * @param ctx
     * @returns {Promise<*>}
     */
    async addProject(ctx) {
        let params = ctx.request.body;
        params = yapi.commons.handleParams(params, {
            created_at: "string",
            updated_at: "string",
            event_name: "string",
            name: "string",
            path: "string",
            path_with_namespace: "string",
            project_id: "number",
            project_visibility: "string"
        });
        if (params.event_name !== "project_create") {
            return (ctx.body = yapi.commons.resReturn(null, 500, "event must be project_create"));
        }
        let namespace = (params.path_with_namespace.substring(0, params.path_with_namespace.lastIndexOf("/" + params.path))).split("/");
        let group_name = namespace[namespace.length - 1];
        if (group_name && group_name !== "") {
            let group = await this.groupModel.getByName(group_name);
            if (!group) {
                // 创建group
                group = await this.addGroup({
                    group_name: group_name,
                    owner_uids: []
                });
            }
            return this.createProject(ctx, {
                name: params.name,
                basepath: "",
                group_id: group._id,
                group_name: group.group_name,
                project_type: params.project_visibility === "visibilitylevel|private"?"private":"public"
            });
        } else {
            return (ctx.body = yapi.commons.resReturn(null, 500, "无法获取分组名称"));
        }
    }

    /**
     * gitlab 分组同步
     * @param ctx
     * @returns {Promise<{errcode, errmsg, data}>}
     */
    async asyncGroup(ctx) {
        let group = ctx.request.body;
        group = yapi.commons.handleParams(group, {
            add_time: "number",
            group_name: "string",
            role: "string",
            uid: "number",
            _id: "number",
        });
        let ops = this.getOptions();
        try {
            let members = await this.searchGitUserByTag(ops, group.group_name, "groups");
            let result = await this.updateMemberAll(group._id, members, ops, "groups");
            return (ctx.body = yapi.commons.resReturn({}));
        } catch (e) {
            return (ctx.body = yapi.commons.resReturn(null, 500, e.message));
        }
    }

    /**
     * 项目成员同步
     * @param ctx
     * @returns {Promise<{errcode, errmsg, data}>}
     */
    async asyncProjectGroup(ctx) {
        let project = ctx.request.body;
        project = yapi.commons.handleParams(project, {
            add_time: "number",
            group_id: "number",
            name: "string",
            role: "string",
            uid: "number",
            _id: "number",
        });
        let ops = this.getOptions();
        try {
            let group = await this.groupModel.get(project.group_id);
            let members = await this.searchGitUserByTag(ops, project.name, "projects", group.group_name);
            let result = await this.updateMemberAll(project._id, members, ops, "projects");
            return (ctx.body = yapi.commons.resReturn({}));
        } catch (e) {
            return (ctx.body = yapi.commons.resReturn(null, 500, e.message));
        }
    }

    /**
     * 获取插件配置
     * @returns {*}
     */
    getOptions() {
        for (let i = 0; i < yapi.WEBCONFIG.plugins.length; i++) {
            if (yapi.WEBCONFIG.plugins[i].name === "gitlab") {
                return yapi.WEBCONFIG.plugins[i].options;
            }
        }
        return null;
    }

    /**
     * 通过token获取gitlab当前用户
     * @param ops
     * @param token
     * @returns {Promise<any>}
     */
    getGitLabUser(ops, token) {
        return new Promise((resolve, reject)=>{
            request(ops.host + ops.loginPath, {
                method: "get",
                headers: {
                    "Authorization": "Bearer " + token
                }
            },function (error, response, body) {
                if (!error && response.statusCode == 200) {
                    resolve(JSON.parse(body));
                }
                reject(body);
            })
        });
    }

    /**
     * 通过project id 获取明细
     * @param ops
     * @param id
     * @returns {Promise<any>}
     */
    searchGitLabProjectById(ops, id) {
        return new Promise((resolve, reject)=>{
            request(ops.host + "/api/v4/projects/" + id, {
                method: "get",
                headers: {
                    "Private-Token": ops.accessToken
                }
            },function (error, response, body) {
                if (!error && response.statusCode == 200) {
                    resolve(JSON.parse(body));
                }
                reject(body);
            })
        });
    }

    /**
     * 通过gitlab userId 查询用户明细
     * @param ops
     * @param id
     * @returns {Promise<any>}
     */
    searchGitLabUserById(ops, id) {
        return new Promise((resolve, reject)=>{
            request(ops.host + "/api/v4/users/" + id, {
                method: "get",
                headers: {
                    "Private-Token": ops.accessToken
                }
            },function (error, response, body) {
                if (!error && response.statusCode == 200) {
                    resolve(JSON.parse(body));
                }
                reject(body);
            })
        });
    }

    /**
     * 获取所有分组成员（为支持gitlab 10.0.0 放弃/members/all 接口）
     * @param ops
     * @param name
     * @param tag
     * @param groupName
     * @returns {Promise<*>}
     */
    async searchGitUserByTag(ops, name, tag, groupName) {
        try {
            let map = new Map();
            let obj = await this.searchGitLabGroup(ops, name, tag, groupName);
            if (tag === "projects") {
                let us = await this.searchGitlabMember(ops, obj.id, tag);
                if (obj.namespace.kind === "user") {
                    return us;
                }
                us.forEach(item => {
                    map.set(item.id, item);
                });
                obj = await this.searchGitLabGroupById(ops, obj.namespace.id);
            }
            let temp = JSON.parse(JSON.stringify(obj));
            map = await this.getParentGroup(ops, map, temp);
            return Array.from(map.values());
        } catch (e) {
            throw e;
        }
    }

    /**
     * 迭代获取父节点分组成员
     * @param ops
     * @param map
     * @param temp
     * @returns {Promise<*>}
     */
    async getParentGroup(ops, map, temp) {
        let members = await this.searchGitlabMember(ops, temp.id, "groups");
        members.forEach(item => {
            if (!map.has(item.id)) {
                map.set(item.id, item);
            }
        });
        if (temp.parent_id) {
            temp = await this.searchGitLabGroupById(ops, temp.parent_id);
            map = await this.getParentGroup(ops, map, temp);
        }
        return map;
    }

    /**
     * 查询gitlab 分组下所有用户
     * @param ops
     * @param id
     * @returns {Promise<*>}
     */
    async searchGitlabMember(ops, id, tag) {
        return new Promise((resolve, reject)=>{
            request(ops.host + "/api/v4/" + tag + "/" + id + "/members", {
                method: "get",
                headers: {
                    "Private-Token": ops.accessToken
                }
            },function (error, response, body) {
                if (!error && response.statusCode == 200) {
                    resolve(JSON.parse(body));
                }
                reject(body);
            })
        });
    }

    /**
     * 通过分组Id 查询分组明细
     * @param ops
     * @param id
     * @returns {Promise<*>}
     */
    async searchGitLabGroupById(ops, id) {
        return new Promise((resolve, reject)=>{
            request(ops.host + "/api/v4/groups/" + id, {
                method: "get",
                headers: {
                    "Private-Token": ops.accessToken
                }
            },function (error, response, body) {
                if (!error && response.statusCode == 200) {
                    resolve(JSON.parse(body));
                }
                reject(body);
            })
        });
    }

    /**
     * 查询gitlab 分组或者项目明细
     * @param ops
     * @param groupName
     * @returns {Promise<*>}
     */
    async searchGitLabGroup(ops, name, tag, groupName) {
        return new Promise((resolve, reject)=>{
            request(ops.host + "/api/v4/" + tag + "?search=" + name, {
                method: "get",
                headers: {
                    "Private-Token": ops.accessToken
                }
            },function (error, response, body) {
                if (!error && response.statusCode == 200) {
                    let array = JSON.parse(body);
                    if (!Array.isArray(array) || array.length < 1) {
                        reject({message: "not find " + tag});
                    } else {
                        if (tag === "groups" && name === array[0].name) {
                            resolve(array[0]);
                        } else {
                            for (let i = 0; i < array.length; i++) {
                                let nameWithSpace = array[i].name_with_namespace.replace(new RegExp(" ","gm"), "");
                                if (nameWithSpace.indexOf(groupName + "/" + name) > -1) {
                                    resolve(array[i]);
                                }
                            }
                        }
                        reject({message: "not find " + tag});
                    }
                }
                reject(body);
            })
        });
    }

    /**
     * 更新yapi分组成员
     * @param group
     * @param members
     * @param ops
     * @returns {Promise<*>}
     */
    async updateMemberAll(id, members, ops, tag) {
        let owners = [];
        for (let i = 0; i < members.length; i++) {
            let gitlabUser = await this.searchGitLabUserById(ops, members[i].id);
            let user = await this.handleThirdLogin(gitlabUser[ops.emailKey], gitlabUser[ops.userKey])
            owners.push({
                _role: user.role,
                role: members[i].access_level > 30? "owner" : members[i].access_level > 20? "dev" : "guest",
                uid: user._id,
                username: user.username,
                email: user.email
            })
        }
        let result = null;
        if (tag === "groups") {
            result = await this.groupModel.updateAll({
                _id: id,
                members: owners
            });
        } else {
            result = await this.projectModel.updateAll({
                _id: id,
                members: owners
            });
        }

        let username = this.$user.username;
        yapi.commons.saveLog({
            content: `<a href="/user/profile/${this.getUid()}">${username}</a> 从gitlab同步了分组`,
            type: tag === "groups"?"group":"project",
            uid: this.getUid(),
            username: username,
            typeid: id
        });
        return result;
    }

    /**
     * 新增分组
     * @param {String} group_name 项目分组名称，不能为空
     * @param {String} [group_desc] 项目分组描述
     * @param {String} [owner_uids]  组长[uid]
     * @param params
     * @returns group
     */
    async addGroup(params) {
        let owners = [];
        if(params.owner_uids.length === 0){
            params.owner_uids.push(
                this.getUid()
            )
        }

        if (params.owner_uids) {
            for (let i = 0, len = params.owner_uids.length; i < len; i++) {
                let id = params.owner_uids[i];
                let groupUserdata = await this.getUserdata(id, "owner");
                if (groupUserdata) {
                    owners.push(groupUserdata);
                }
            }
        }

        let groupInst = yapi.getInst(groupModel);

        let checkRepeat = await groupInst.checkRepeat(params.group_name);

        if (checkRepeat > 0) {
            return (ctx.body = yapi.commons.resReturn(null, 401, "项目分组名已存在"));
        }

        let data = {
            group_name: params.group_name,
            group_desc: params.group_desc,
            uid: this.getUid(),
            add_time: yapi.commons.time(),
            up_time: yapi.commons.time(),
            members: owners
        };

        let result = await groupInst.save(data);
        result = yapi.commons.fieldSelect(result, [
            "_id",
            "group_name",
            "group_desc",
            "uid",
            "members",
            "type"
        ]);
        return result;
    }

    /**
     * 添加项目分组
     * @interface /project/add
     * @method POST
     * @category project
     * @foldnumber 10
     * @param {String} name 项目名称，不能为空
     * @param {String} basepath 项目基本路径，不能为空
     * @param {Number} group_id 项目分组id，不能为空
     * @param {Number} group_name 项目分组名称，不能为空
     * @param {String} project_type private public
     * @param  {String} [desc] 项目描述
     * @returns {Object}
     * @example ./api/project/add.json
     */
    async createProject(ctx, params) {
        if ((await this.checkAuth(params.group_id, "group", "edit")) !== true) {
            return (ctx.body = yapi.commons.resReturn(null, 405, "没有权限"));
        }

        let checkRepeat = await this.projectModel.checkNameRepeat(params.name, params.group_id);

        if (checkRepeat > 0) {
            return (ctx.body = yapi.commons.resReturn(null, 401, "已存在的项目名"));
        }

        params.basepath = params.basepath || "";

        if ((params.basepath = this.handleBasepath(params.basepath)) === false) {
            return (ctx.body = yapi.commons.resReturn(null, 401, "basepath格式有误"));
        }

        let data = {
            name: params.name,
            desc: params.desc,
            basepath: params.basepath,
            members: [],
            project_type: params.project_type || "private",
            uid: this.getUid(),
            group_id: params.group_id,
            group_name: params.group_name,
            icon: params.icon,
            color: params.color,
            add_time: yapi.commons.time(),
            up_time: yapi.commons.time(),
            is_json5: false,
            env: [{ name: "local", domain: "http://127.0.0.1" }]
        };

        let result = await this.projectModel.save(data);
        let colInst = yapi.getInst(interfaceColModel);
        let catInst = yapi.getInst(interfaceCatModel);
        if (result._id) {
            await colInst.save({
                name: "公共测试集",
                project_id: result._id,
                desc: "公共测试集",
                uid: this.getUid(),
                add_time: yapi.commons.time(),
                up_time: yapi.commons.time()
            });
            await catInst.save({
                name: "公共分类",
                project_id: result._id,
                desc: "公共分类",
                uid: this.getUid(),
                add_time: yapi.commons.time(),
                up_time: yapi.commons.time()
            });
        }
        let uid = this.getUid();
        // 将项目添加者变成项目组长,除admin以外
        if (this.getRole() !== "admin") {
            let userdata = await yapi.commons.getUserdata(uid, "owner");
            await this.projectModel.addMember(result._id, [userdata]);
        }
        let username = this.getUsername();
        yapi.commons.saveLog({
            content: `<a href="/user/profile/${this.getUid()}">${username}</a> 添加了项目 <a href="/project/${
                result._id
                }">${params.name}</a>`,
            type: "project",
            uid,
            username: username,
            typeid: result._id
        });
        yapi.emitHook("project_add", result).then();
        return ctx.body = yapi.commons.resReturn(result);
    }

    // 处理第三方登录
    async handleThirdLogin(email, username) {
        let user, data, passsalt;
        let userInst = yapi.getInst(userModel);

        try {
            user = await userInst.findByEmail(email);

            // 新建用户信息
            if (!user || !user._id) {
                passsalt = yapi.commons.randStr();
                data = {
                    username: username,
                    password: yapi.commons.generatePassword(passsalt, passsalt),
                    email: email,
                    passsalt: passsalt,
                    role: "member",
                    add_time: yapi.commons.time(),
                    up_time: yapi.commons.time(),
                    type: "third"
                };
                user = await userInst.save(data);
                await this.handlePrivateGroup(user._id, username, email);
                yapi.commons.sendMail({
                    to: email,
                    contents: `<h3>亲爱的用户：</h3><p>您好，感谢使用YApi平台，你的邮箱账号是：${email}</p>`
                });
            }
            return user;
        } catch (e) {
            throw new Error(`third_login: ${e.message}`);
        }
    }

    /**
     * 获取用户数据
     * @param uid
     * @param role
     * @returns {Promise.<*>}
     */
    async getUserdata(uid, role) {
        role = role || "dev";
        let userInst = yapi.getInst(userModel);
        let userData = await userInst.findById(uid);
        if (!userData) {
            return null;
        }
        return {
            _role: userData.role,
            role: role,
            uid: userData._id,
            username: userData.username,
            email: userData.email
        };
    }

    handleBasepath(basepath) {
        if (!basepath) {
            return "";
        }
        if (basepath === "/") {
            return "";
        }
        if (basepath[0] !== "/") {
            basepath = "/" + basepath;
        }
        if (basepath[basepath.length - 1] === "/") {
            basepath = basepath.substr(0, basepath.length - 1);
        }
        if (!/^\/[a-zA-Z0-9\-\/\._]+$/.test(basepath)) {
            return false;
        }
        return basepath;
    }

    async handlePrivateGroup(uid) {
        await this.groupModel.save({
            uid: uid,
            group_name: "User-" + uid,
            add_time: yapi.commons.time(),
            up_time: yapi.commons.time(),
            type: "private"
        });
    }
}

module.exports = gitlabController;
