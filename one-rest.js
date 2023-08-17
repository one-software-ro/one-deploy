module.exports = class OneRestService {
    constructor(axios, host, security, jar, errorCb) {
        this.errorCb = errorCb;
        this.axios = axios;
        this.securityToken = '';
        this.securityParams = '';
        this.host = host;
        this.jar = jar;
        if (security.token && security.token.length) {
            this.securityToken = security.token;
        }
    }
  
    handleError(error) {
        if (error.response) {
            // Request made and server responded
            if (error.response.status === 401) {
                this.errorCb('Neautorizat');
            }
            this.errorCb("Eroare: " + error.response.status);
            return;
        }
        // Something happened in setting up the request that triggered an Error
        this.errorCb("Something happened in setting up the request that triggered an Error");
    }
  
    async getCookie(name) {
        let cookies = await this.jar.getAllCookies()
        for (let ind = 0; ind < cookies.length; ind++) {
            if (cookies[ind].key === name) {
                return cookies[ind].value;
            }
        }
        return null;
    }
  
    async handleAuth(config) {
        if (this.securityParams) {
          config.path += this.securityParams;
        }
        let csrfToken = await this.getCookie('one.erp.rest.csrf.token');
        if (csrfToken) {
          config.postConfig.headers['X-CSRF-TOKEN'] = csrfToken;
        } else if (this.securityToken) {
          config.postConfig.headers['X-API-Key'] = this.securityToken;
        }
    }

    async auth(username, password) {
        var qs = require('qs');
        let form = {
            'user': username,
            'password': password
        }
        let postConfig = {
            headers: {
                'content-type': 'application/x-www-form-urlencoded'
            }
        };
        try {
            let response = await this.axios.post(this.host + '/auth', qs.stringify(form), postConfig)
            if (response.status === 200) {
                return response.data;
            }
        } catch (error) {
            this.handleError(error);
        }
    }
  
    async get(entityName, key) {
        let config = {
            path: this.host + '/rest/entity/' + entityName + '/' + key,
            postConfig: {
                headers: {}
            }
        }
        await this.handleAuth(config);
        try {
            let response = await this.axios.get(config.path, config.postConfig);
            if (response.status === 200) {
                return response.data;
            }
        } catch (error) {
            this.handleError(error);
        }
    }
  
    async put(entityName, entity) {
        let config = {
            path: this.host + '/rest/entity/' + entityName,
            postConfig: {
                headers: {}
            }
        }
        await this.handleAuth(config);
        try {
            let response = await this.axios.post(config.path, entity, config.postConfig);
            if (response.status === 200) {
                return response.data.key;
            }
        } catch (error) {
            this.handleError(error);
        }
        return null;
    }
  
    async update(entityName, entity) {
        let config = {
            path: this.host + '/rest/entity/' + entityName + '/' + entity.properties.key,
            postConfig: {
                headers: {}
            }
        }
        await this.handleAuth(config);
        try {
            let response = await this.axios.post(config.path, entity, config.postConfig);
            if (response.status === 200) {
                return response.data.key;
            }
        } catch (error) {
            this.handleError(error);
        }
        return false;
    }
  
    async delete(entityName, entityKey) {
        let config = {
            path: this.host + '/rest/entity/' + entityName + '/' + entityKey,
            postConfig: {
                headers: {}
            }
        }
        await this.handleAuth(config);
        try {
            let response = await this.axios.delete(config.path, config.postConfig);
            if (response.status === 200) {
                return true;
            }
        } catch (error) {
            this.handleError(error);
        }
        return false;
    }
  
    async fetch(query) {
        let config = {
            path: this.host + '/rest/fetch',
            postConfig: {
                headers: {
                    'Content-Type': 'text/plain; charset=UTF-8'
                }
            }
        }
        await this.handleAuth(config);
        try {
            let response = await this.axios.post(config.path, query, config.postConfig);
            if (response.status === 200) {
                return response.data;
            }
        } catch (error) {
            this.handleError(error);
        }
        return null;
    }
  
    async workflow(wfName, wfMethod, wfRequest) {
        let config = {
            path: this.host + '/rest/workflow/' + wfName + '/' + wfMethod,
            postConfig: {
                headers: {
                    'Content-Type': 'application/json; charset=UTF-8'
                }
            }
        }
        await this.handleAuth(config);
        try {
            const response = await this.axios.post(config.path, wfRequest || {}, config.postConfig);
            return response;
        } catch (error) {
            this.handleError(error);
            throw error;
        }
    }

    async storage(stream) {
        var FormData = require('form-data');
        let formData = new FormData();
        formData.append('file', stream);
        let config = {
            postConfig: {
                headers: {
                    ...formData.getHeaders()
                },
                maxContentLength: 100000000,
                maxBodyLength: 1000000000
            }
        };
        await this.handleAuth(config);
        try {
            let response = await this.axios.post(this.host + '/storage', formData, config.postConfig)
            if (response.status === 200) {
                return response.data;
            }
        } catch (error) {
            this.handleError(error);
        }
    }
  }