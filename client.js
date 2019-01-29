import React, { Component } from 'react'
import Group from './group/Group.js'
import ProjectMember from './group/ProjectMember'

/**
 *
 * @param options
 */
module.exports = function (options) {

    const gitLablogin = () => {
        const {host, redirectUri, authPath, appId} = options;
        location.href = host + authPath + '?client_id=' + appId +
            '&redirect_uri=' + encodeURIComponent(redirectUri) +
            '&response_type=code&scope=api';
    }

    const GitLabComponent = () => (
        <button onClick={gitLablogin} className="btn-home btn-home-normal" >GitLab登录</button>
    )

    this.bindHook('third_login', GitLabComponent);

    this.bindHook('app_route', function (router) {
        router.group = {
            path: '/group',
            component: Group
        }
    });

    this.bindHook('sub_nav', function (router) {
        router.members = {
            name: '成员管理',
            path: '/project/:id/members',
            component: ProjectMember
        }
    });
};






