import React, { Component } from 'react'

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
};






