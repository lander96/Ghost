const _ = require('lodash');
const url = require('./utils/url');
const typeGroupMapper = require('../../../../shared/serializers/input/utils/settings-filter-type-group-mapper');
const settingsCache = require('../../../../../services/settings/cache');

const DEPRECATED_SETTINGS = [
    'bulk_email_settings',
    'slack'
];

const deprecatedSupportedSettingsOneToManyMap = {
    slack: [{
        from: '[0].url',
        to: {
            key: 'slack_url',
            group: 'slack',
            type: 'string'
        }
    }, {
        from: '[0].username',
        to: {
            key: 'slack_username',
            group: 'slack',
            type: 'string'
        }
    }]
};

const getMappedDeprecatedSettings = (settings) => {
    const mappedSettings = [];

    for (const key in deprecatedSupportedSettingsOneToManyMap) {
        const deprecatedSetting = settings.find(setting => setting.key === key);

        if (deprecatedSetting) {
            let deprecatedSettingValue;

            try {
                deprecatedSettingValue = JSON.parse(deprecatedSetting.value);
            } catch (err) {
                // ignore the value if it's invalid
            }

            if (deprecatedSettingValue) {
                deprecatedSupportedSettingsOneToManyMap[key].forEach(({from, to}) => {
                    const value = _.get(deprecatedSettingValue, from);
                    mappedSettings.push({
                        key: to.key,
                        value: value
                    });
                });
            }
        }
    }

    return mappedSettings;
};

module.exports = {
    browse(apiConfig, frame) {
        if (frame.options.type) {
            let mappedGroupOptions = typeGroupMapper(frame.options.type);

            frame.options.group = mappedGroupOptions;
        }
    },

    read(apiConfig, frame) {
        if (frame.options.key === 'ghost_head') {
            frame.options.key = 'codeinjection_head';
        }

        if (frame.options.key === 'ghost_foot') {
            frame.options.key = 'codeinjection_foot';
        }

        if (frame.options.key === 'default_locale') {
            frame.options.key = 'lang';
        }

        if (frame.options.key === 'active_timezone') {
            frame.options.key = 'timezone';
        }
    },

    edit(apiConfig, frame) {
        // CASE: allow shorthand syntax where a single key and value are passed to edit instead of object and options
        if (_.isString(frame.data)) {
            frame.data = {settings: [{key: frame.data, value: frame.options}]};
        }

        const settings = settingsCache.getAll();

        frame.data.settings = frame.data.settings.filter((setting) => {
            const settingFlagsStr = settings[setting.key] ? settings[setting.key].flags : '';
            const settingFlagsArr = settingFlagsStr ? settingFlagsStr.split(',') : [];

            // Ignore and drop all values with Read-only flag AND 'labs' setting
            return !settingFlagsArr.includes('RO') && (setting.key !== 'labs');
        });

        frame.data.settings.push(...getMappedDeprecatedSettings(frame.data.settings));

        frame.data.settings.forEach((setting) => {
            const settingType = settings[setting.key] ? settings[setting.key].type : '';

            // TODO: Needs to be removed once we get rid of all `object` type settings
            // NOTE: this transformation is more related to the fact that internal API calls call
            //       settings API with plain objects instead of stringified ones
            if (_.isObject(setting.value)) {
                setting.value = JSON.stringify(setting.value);
            }

            // CASE: Ensure we won't forward strings for booleans, otherwise model events or model interactions can fail
            if (settingType === 'boolean' && (setting.value === '0' || setting.value === '1')) {
                setting.value = !!+setting.value;
            }

            // CASE: Ensure we won't forward strings for booleans, otherwise model events or model interactions can fail
            if (settingType === 'boolean' && (setting.value === 'false' || setting.value === 'true')) {
                setting.value = setting.value === 'true';
            }

            if (setting.key === 'ghost_head') {
                setting.key = 'codeinjection_head';
            }

            if (setting.key === 'ghost_foot') {
                setting.key = 'codeinjection_foot';
            }

            if (setting.key === 'default_locale') {
                setting.key = 'lang';
            }

            if (setting.key === 'active_timezone') {
                setting.key = 'timezone';
            }

            if (setting.key === 'unsplash') {
                setting.value = JSON.parse(setting.value).isActive;
            }

            setting = url.forSetting(setting);
        });

        // Ignore all deprecated settings
        frame.data.settings = frame.data.settings.filter((setting) => {
            return DEPRECATED_SETTINGS.includes(setting.key) === false;
        });
    }
};
