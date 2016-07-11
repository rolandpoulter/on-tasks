// Copyright 2016, EMC, Inc.

'use strict';


module.exports = {
    friendlyName: 'Base Docker Task',
    injectableName: 'Task.Base.Docker',
    runJob: 'Job.Docker',
    requiredOptions: [
        'exec'
    ],
    properties: {},
    requiredProperties: []
};
