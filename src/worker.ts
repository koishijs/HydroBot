import crypto from 'crypto';
import { internal, mapDirectory } from 'koishi-plugin-eval/dist/worker';
import moment from 'moment';
import _ from 'lodash';
import yaml from 'js-yaml';

internal.setGlobal('crypto', crypto, false);
internal.setGlobal('moment', moment, false);
internal.setGlobal('_', _, false);
internal.setGlobal('yaml', yaml, false);
mapDirectory('moment', require.resolve('moment'));
mapDirectory('lodash', require.resolve('lodash'));
mapDirectory('js-yaml', require.resolve('js-yaml'));
