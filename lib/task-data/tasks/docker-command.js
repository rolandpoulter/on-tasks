// Copyright 2016, EMC, Inc.

'use strict';

module.exports = {
    friendlyName: 'Docker Command',
    injectableName: 'Task.Docker.Command',
    implementsTask: 'Task.Base.Docker',
    options: {
        ca: null,
        cert: null,
        exec: [],
        host: '127.0.0.1',
        key: null,
        port: 2375,
        protocol: 'http'
    },
    properties: {}
};
