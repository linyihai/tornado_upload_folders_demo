/*
 * jQuery File Upload Plugin
 * https://github.com/blueimp/jQuery-File-Upload
 *
 * Copyright 2010, Sebastian Tschan
 * https://blueimp.net
 *
 * Licensed under the MIT license:
 * http://www.opensource.org/licenses/MIT
 */

/* jshint nomen:false */
/* global define, require, window, document, location, Blob, FormData */
var GLOBAL_IS_CONNECT = {};//一个全局变量记录了每个文件上传成功或者失败;在点击添加文件夹按钮后清空该对象
function get_filemd5sum(ofile) {
    var file = ofile;
    var tmp_md5;
    var blobSlice = File.prototype.slice || File.prototype.mozSlice || File.prototype.webkitSlice,
        // file = this.files[0],
        chunkSize = 8097152, // Read in chunks of 2MB
        chunks = Math.ceil(file.size / chunkSize),
        currentChunk = 0,
        spark = new SparkMD5.ArrayBuffer(),
        fileReader = new FileReader();

    fileReader.onload = function(e) {
        // console.log('read chunk nr', currentChunk + 1, 'of', chunks);
        spark.append(e.target.result); // Append array buffer
        currentChunk++;

        if (currentChunk < chunks) {
            loadNext();
        } else {
            tmp_md5 = spark.end();
        }
    };

    fileReader.onerror = function() {
        console.warn('oops, something went wrong.');
    };

    function loadNext() {
        var start = currentChunk * chunkSize,
            end = ((start + chunkSize) >= file.size) ? file.size : start + chunkSize;

        fileReader.readAsArrayBuffer(blobSlice.call(file, start, end));
    }
    loadNext();
    return tmp_md5;
}

(function(factory) {
    'use strict';
    if (typeof define === 'function' && define.amd) {
        // Register as an anonymous AMD module:
        define([
            'jquery',
            'jquery.ui.widget'
        ], factory);
    } else if (typeof exports === 'object') {
        // Node/CommonJS:
        factory(
            require('jquery'),
            require('./vendor/jquery.ui.widget')
        );
    } else {
        // Browser globals:
        factory(window.jQuery);
    }
}(function($) {
    'use strict';

    // Detect file input support, based on
    // http://viljamis.com/blog/2012/file-upload-support-on-mobile/
    $.support.fileInput = !(new RegExp(
            // Handle devices which give false positives for the feature detection:
            '(Android (1\\.[0156]|2\\.[01]))' +
            '|(Windows Phone (OS 7|8\\.0))|(XBLWP)|(ZuneWP)|(WPDesktop)' +
            '|(w(eb)?OSBrowser)|(webOS)' +
            '|(Kindle/(1\\.0|2\\.[05]|3\\.0))'
        ).test(window.navigator.userAgent) ||
        // Feature detection for all other devices:
        $('<input type="file">').prop('disabled'));

    // The FileReader API is not actually used, but works as feature detection,
    // as some Safari versions (5?) support XHR file uploads via the FormData API,
    // but not non-multipart XHR file uploads.
    // window.XMLHttpRequestUpload is not available on IE10, so we check for
    // window.ProgressEvent instead to detect XHR2 file upload capability:
    $.support.xhrFileUpload = !!(window.ProgressEvent && window.FileReader);
    $.support.xhrFormDataFileUpload = !!window.FormData;
    // Detect support for Blob slicing (required for chunked uploads):
    $.support.blobSlice = window.Blob && (Blob.prototype.slice ||
        Blob.prototype.webkitSlice || Blob.prototype.mozSlice);

    // Helper function to create drag handlers for dragover/dragenter/dragleave:
    function getDragHandler(type) {
        var isDragOver = type === 'dragover';
        return function(e) {
            e.dataTransfer = e.originalEvent && e.originalEvent.dataTransfer;
            var dataTransfer = e.dataTransfer;
            if (dataTransfer && $.inArray('Files', dataTransfer.types) !== -1 &&
                this._trigger(
                    type,
                    $.Event(type, {
                        delegatedEvent: e
                    })
                ) !== false) {
                e.preventDefault();
                if (isDragOver) {
                    dataTransfer.dropEffect = 'copy';
                }
            }
        };
    }

    // The fileupload widget listens for change events on file input fields defined
    // via fileInput setting and paste or drop events of the given dropZone.
    // In addition to the default jQuery Widget methods, the fileupload widget
    // exposes the "add" and "send" methods, to add or directly send files using
    // the fileupload API.
    // By default, files added via file input selection, paste, drag & drop or
    // "add" method are uploaded immediately, but it is possible to override
    // the "add" callback option to queue file uploads.
    $.widget('blueimp.fileupload', {

        options: {
            // The drop target element(s), by the default the complete document.
            // Set to null to disable drag & drop support:
            dropZone: $(document),
            // The paste target element(s), by the default undefined.
            // Set to a DOM node or jQuery object to enable file pasting:
            pasteZone: undefined,
            // The file input field(s), that are listened to for change events.
            // If undefined, it is set to the file input fields inside
            // of the widget element on plugin initialization.
            // Set to null to disable the change listener.
            fileInput: undefined,
            // By default, the file input field is replaced with a clone after
            // each input field change event. This is required for iframe transport
            // queues and allows change events to be fired for the same file
            // selection, but can be disabled by setting the following option to false:
            replaceFileInput: true,
            // The parameter name for the file form data (the request argument name).
            // If undefined or empty, the name property of the file input field is
            // used, or "files[]" if the file input name property is also empty,
            // can be a string or an array of strings:
            paramName: undefined,
            // By default, each file of a selection is uploaded using an individual
            // request for XHR type uploads. Set to false to upload file
            // selections in one request each:
            singleFileUploads: true,
            // To limit the number of files uploaded with one XHR request,
            // set the following option to an integer greater than 0:
            limitMultiFileUploads: undefined,
            // The following option limits the number of files uploaded with one
            // XHR request to keep the request size under or equal to the defined
            // limit in bytes:
            limitMultiFileUploadSize: undefined,
            // Multipart file uploads add a number of bytes to each uploaded file,
            // therefore the following option adds an overhead for each file used
            // in the limitMultiFileUploadSize configuration:
            limitMultiFileUploadSizeOverhead: 512,
            // Set the following option to true to issue all file upload requests
            // in a sequential order:
            sequentialUploads: false,
            // To limit the number of concurrent uploads,
            // set the following option to an integer greater than 0:
            limitConcurrentUploads: undefined,
            // Set the following option to true to force iframe transport uploads:
            forceIframeTransport: false,
            // Set the following option to the location of a redirect url on the
            // origin server, for cross-domain iframe transport uploads:
            redirect: undefined,
            // The parameter name for the redirect url, sent as part of the form
            // data and set to 'redirect' if this option is empty:
            redirectParamName: undefined,
            // Set the following option to the location of a postMessage window,
            // to enable postMessage transport uploads:
            postMessage: undefined,
            // By default, XHR file uploads are sent as multipart/form-data.
            // The iframe transport is always using multipart/form-data.
            // Set to false to enable non-multipart XHR uploads:
            multipart: true,
            // To upload large files in smaller chunks, set the following option
            // to a preferred maximum chunk size. If set to 0, null or undefined,
            // or the browser does not support the required Blob API, files will
            // be uploaded as a whole.
            maxChunkSize: undefined,
            // When a non-multipart upload or a chunked multipart upload has been
            // aborted, this option can be used to resume the upload by setting
            // it to the size of the already uploaded bytes. This option is most
            // useful when modifying the options object inside of the "add" or
            // "send" callbacks, as the options are cloned for each file upload.
            uploadedBytes: undefined,
            // By default, failed (abort or error) file uploads are removed from the
            // global progress calculation. Set the following option to false to
            // prevent recalculating the global progress data:
            recalculateProgress: true,
            // Interval in milliseconds to calculate and trigger progress events:
            progressInterval: 100,
            // Interval in milliseconds to calculate progress bitrate:
            bitrateInterval: 500,
            // By default, uploads are started automatically when adding files:
            autoUpload: true,

            // Error and info messages:
            messages: {
                uploadedBytes: 'Uploaded bytes exceed file size'
            },

            // Translation function, gets the message key to be translated
            // and an object with context specific data as arguments:
            i18n: function(message, context) {
                message = this.messages[message] || message.toString();
                if (context) {
                    $.each(context, function(key, value) {
                        message = message.replace('{' + key + '}', value);
                    });
                }
                return message;
            },

            // Additional form data to be sent along with the file uploads can be set
            // using this option, which accepts an array of objects with name and
            // value properties, a function returning such an array, a FormData
            // object (for XHR file uploads), or a simple object.
            // The form of the first fileInput is given as parameter to the function:
            formData: function(form) {
                return form.serializeArray();
            },

            // The add callback is invoked as soon as files are added to the fileupload
            // widget (via file input selection, drag & drop, paste or add API call).
            // If the singleFileUploads option is enabled, this callback will be
            // called once for each file in the selection for XHR file uploads, else
            // once for each file selection.
            //
            // The upload starts when the submit method is invoked on the data parameter.
            // The data object contains a files property holding the added files
            // and allows you to override plugin options as well as define ajax settings.
            //
            // Listeners for this callback can also be bound the following way:
            // .bind('fileuploadadd', func);
            //
            // data.submit() returns a Promise object and allows to attach additional
            // handlers using jQuery's Deferred callbacks:
            // data.submit().done(func).fail(func).always(func);
            add: function(e, data) {
                if (e.isDefaultPrevented()) {
                    return false;
                }
                if (data.autoUpload || (data.autoUpload !== false &&
                        $(this).fileupload('option', 'autoUpload'))) {
                    console.log(data)
                    data.process().done(function() {
                        data.submit();
                    });
                }
            },

            // Other callbacks:

            // Callback for the submit event of each file upload:
            // submit: function (e, data) {}, // .bind('fileuploadsubmit', func);

            // Callback for the start of each file upload request:
            // send: function (e, data) {}, // .bind('fileuploadsend', func);

            // Callback for successful uploads:
            done: function(e, data) {}, // .bind('fileuploaddone', func);

            // Callback for failed (abort or error) uploads:

            // Callback for completed (success, abort or error) requests:
            // always: function (e, data) {}, // .bind('fileuploadalways', func);

            // Callback for upload progress events:
            // progress: function (e, data) {}, // .bind('fileuploadprogress', func);

            // Callback for global upload progress events:
            progressall: function(e, data) {}, // .bind('fileuploadprogressall', func);

            // Callback for uploads start, equivalent to the global ajaxStart event:
            // start: function (e) {}, // .bind('fileuploadstart', func);

            // Callback for uploads stop, equivalent to the global ajaxStop event:
            // stop: function (e) {}, // .bind('fileuploadstop', func);

            // Callback for change events of the fileInput(s):
            // change: function (e, data) {}, // .bind('fileuploadchange', func);

            // Callback for paste events to the pasteZone(s):
            // paste: function (e, data) {}, // .bind('fileuploadpaste', func);

            // Callback for drop events of the dropZone(s):
            // drop: function (e, data) {}, // .bind('fileuploaddrop', func);

            // Callback for dragover events of the dropZone(s):
            // dragover: function (e) {}, // .bind('fileuploaddragover', func);

            // Callback for the start of each chunk upload request:
            // chunksend: function (e, data) {}, // .bind('fileuploadchunksend', func);

            // Callback for successful chunk uploads:
            // chunkdone: function (e, data) {}, // .bind('fileuploadchunkdone', func);

            // Callback for failed (abort or error) chunk uploads:
            // chunkfail: function (e, data) {}, // .bind('fileuploadchunkfail', func);

            // Callback for completed (success, abort or error) chunk upload requests:
            // chunkalways: function (e, data) {}, // .bind('fileuploadchunkalways', func);

            // The plugin options are used as settings object for the ajax calls.
            // The following are jQuery ajax settings required for the file uploads:
            processData: false,
            contentType: false,
            cache: false,
            timeout: 0
        },

        // A list of options that require reinitializing event listeners and/or
        // special initialization code:
        _specialOptions: [
            'fileInput',
            'dropZone',
            'pasteZone',
            'multipart',
            'forceIframeTransport'
        ],

        _blobSlice: $.support.blobSlice && function() {
            var slice = this.slice || this.webkitSlice || this.mozSlice;
            return slice.apply(this, arguments);
        },

        _BitrateTimer: function() {
            this.timestamp = ((Date.now) ? Date.now() : (new Date()).getTime());
            this.loaded = 0;
            this.bitrate = 0;
            this.getBitrate = function(now, loaded, interval) {
                var timeDiff = now - this.timestamp;
                if (!this.bitrate || !interval || timeDiff > interval) {
                    this.bitrate = (loaded - this.loaded) * (1000 / timeDiff) * 8;
                    this.loaded = loaded;
                    this.timestamp = now;
                }
                return this.bitrate;
            };
        },

        _isXHRUpload: function(options) {
            return !options.forceIframeTransport &&
                ((!options.multipart && $.support.xhrFileUpload) ||
                    $.support.xhrFormDataFileUpload);
        },

        _getFormData: function(options) {
            var formData;
            if ($.type(options.formData) === 'function') {
                return options.formData(options.form);
            }
            if ($.isArray(options.formData)) {
                return options.formData;
            }
            if ($.type(options.formData) === 'object') {
                formData = [];
                $.each(options.formData, function(name, value) {
                    formData.push({
                        name: name,
                        value: value
                    });
                });
                return formData;
            }
            return [];
        },

        _getTotal: function(files) {
            var total = 0;
            $.each(files, function(index, file) {
                total += file.size || 1;
            });
            return total;
        },

        _initProgressObject: function(obj) {
            var progress = {
                loaded: 0,
                total: 0,
                bitrate: 0
            };
            if (obj._progress) {
                $.extend(obj._progress, progress);
            } else {
                obj._progress = progress;
            }
        },

        _initResponseObject: function(obj) {
            var prop;
            if (obj._response) {
                for (prop in obj._response) {
                    if (obj._response.hasOwnProperty(prop)) {
                        delete obj._response[prop];
                    }
                }
            } else {
                obj._response = {};
            }
        },

        _onProgress: function(e, data) {
            if (e.lengthComputable) {
                var now = ((Date.now) ? Date.now() : (new Date()).getTime()),
                    loaded;
                if (data._time && data.progressInterval &&
                    (now - data._time < data.progressInterval) &&
                    e.loaded !== e.total) {
                    return;
                }
                data._time = now;
                loaded = Math.floor(
                    e.loaded / e.total * (data.chunkSize || data._progress.total)
                ) + (data.uploadedBytes || 0);
                // Add the difference from the previously loaded state
                // to the global loaded counter:
                this._progress.loaded += (loaded - data._progress.loaded);
                this._progress.bitrate = this._bitrateTimer.getBitrate(
                    now,
                    this._progress.loaded,
                    data.bitrateInterval
                );
                data._progress.loaded = data.loaded = loaded;
                data._progress.bitrate = data.bitrate = data._bitrateTimer.getBitrate(
                    now,
                    loaded,
                    data.bitrateInterval
                );
                // Trigger a custom progress event with a total data property set
                // to the file size(s) of the current upload and a loaded data
                // property calculated accordingly:
                this._trigger(
                    'progress',
                    $.Event('progress', {
                        delegatedEvent: e
                    }),
                    data
                );
                // Trigger a global progress event for all current file uploads,
                // including ajax calls queued for sequential file uploads:
                this._trigger(
                    'progressall',
                    $.Event('progressall', {
                        delegatedEvent: e
                    }),
                    this._progress
                );
            }
        },

        _initProgressListener: function(options) {
            var that = this,
                xhr = options.xhr ? options.xhr() : $.ajaxSettings.xhr();
            // Accesss to the native XHR object is required to add event listeners
            // for the upload progress event:
            if (xhr.upload) {
                $(xhr.upload).bind('progress', function(e) {
                    var oe = e.originalEvent;
                    // Make sure the progress event properties get copied over:
                    e.lengthComputable = oe.lengthComputable;
                    e.loaded = oe.loaded;
                    e.total = oe.total;
                    that._onProgress(e, options);
                });
                options.xhr = function() {
                    return xhr;
                };
            }
        },

        _isInstanceOf: function(type, obj) {
            // Cross-frame instanceof check
            return Object.prototype.toString.call(obj) === '[object ' + type + ']';
        },

        _initXHRData: function(options) {
            var that = this,
                formData,
                file = options.files[0],
                // Ignore non-multipart setting if not supported:
                multipart = options.multipart || !$.support.xhrFileUpload,
                paramName = $.type(options.paramName) === 'array' ?
                options.paramName[0] : options.paramName;
            options.headers = $.extend({}, options.headers);
            if (options.contentRange) {
                options.headers['Content-Range'] = options.contentRange;
            }
            if (!multipart || options.blob || !this._isInstanceOf('File', file)) {
                options.headers['Content-Disposition'] = 'attachment; filename="' +
                    encodeURI(file.name) + '"';
            }
            if (!multipart) {
                options.contentType = file.type || 'application/octet-stream';
                options.data = options.blob || file;
            } else if ($.support.xhrFormDataFileUpload) {
                if (options.postMessage) {
                    // window.postMessage does not allow sending FormData
                    // objects, so we just add the File/Blob objects to
                    // the formData array and let the postMessage window
                    // create the FormData object out of this array:
                    formData = this._getFormData(options);
                    if (options.blob) {
                        formData.push({
                            name: paramName,
                            value: options.blob
                        });
                    } else {
                        $.each(options.files, function(index, file) {
                            formData.push({
                                name: ($.type(options.paramName) === 'array' &&
                                    options.paramName[index]) || paramName,
                                value: file
                            });
                        });
                    }
                } else {
                    if (that._isInstanceOf('FormData', options.formData)) {
                        formData = options.formData;
                    } else {
                        formData = new FormData();
                        $.each(this._getFormData(options), function(index, field) {
                            formData.append(field.name, field.value);
                        });
                    }
                    if (options.blob) {
                        formData.append(paramName, options.blob, file.name);
                    } else {
                        $.each(options.files, function(index, file) {
                            // This check allows the tests to run with
                            // dummy objects:
                            if (that._isInstanceOf('File', file) ||
                                that._isInstanceOf('Blob', file)) {
                                formData.append(
                                    ($.type(options.paramName) === 'array' &&
                                        options.paramName[index]) || paramName,
                                    file,
                                    file.uploadName || file.name
                                );
                            }
                        });
                    }
                }
                options.data = formData;
            }
            // Blob reference is not needed anymore, free memory:
            options.blob = null;
        },

        _initIframeSettings: function(options) {
            var targetHost = $('<a></a>').prop('href', options.url).prop('host');
            // Setting the dataType to iframe enables the iframe transport:
            options.dataType = 'iframe ' + (options.dataType || '');
            // The iframe transport accepts a serialized array as form data:
            options.formData = this._getFormData(options);
            // Add redirect url to form data on cross-domain uploads:
            if (options.redirect && targetHost && targetHost !== location.host) {
                options.formData.push({
                    name: options.redirectParamName || 'redirect',
                    value: options.redirect
                });
            }
        },

        _initDataSettings: function(options) {
            if (this._isXHRUpload(options)) {
                if (!this._chunkedUpload(options, true)) {
                    if (!options.data) {
                        this._initXHRData(options);
                    }
                    this._initProgressListener(options);
                }
                if (options.postMessage) {
                    // Setting the dataType to postmessage enables the
                    // postMessage transport:
                    options.dataType = 'postmessage ' + (options.dataType || '');
                }
            } else {
                this._initIframeSettings(options);
            }
        },

        _getParamName: function(options) {
            var fileInput = $(options.fileInput),
                paramName = options.paramName;

            if (!paramName) {
                paramName = [];
                fileInput.each(function() {
                    var input = $(this),
                        name = input.prop('name') || 'files[]',
                        i = (input.prop('files') || [1]).length;
                    while (i) {
                        paramName.push(name);
                        i -= 1;
                    }
                });
                if (!paramName.length) {
                    paramName = [fileInput.prop('name') || 'files[]'];
                }
            } else if (!$.isArray(paramName)) {
                paramName = [paramName];
            }

            return paramName;

        },

        _initFormSettings: function(options) {
            // Retrieve missing options from the input field and the
            // associated form, if available:
            if (!options.form || !options.form.length) {
                options.form = $(options.fileInput.prop('form'));
                // If the given file input doesn't have an associated form,
                // use the default widget file input's form:
                if (!options.form.length) {
                    options.form = $(this.options.fileInput.prop('form'));
                }
            }
            options.paramName = this._getParamName(options);
            if (!options.url) {
                options.url = options.form.prop('action') || location.href;
            }
            // The HTTP request method must be "POST" or "PUT":
            options.type = (options.type ||
                ($.type(options.form.prop('method')) === 'string' &&
                    options.form.prop('method')) || ''
            ).toUpperCase();
            if (options.type !== 'POST' && options.type !== 'PUT' &&
                options.type !== 'PATCH') {
                options.type = 'POST';
            }
            if (!options.formAcceptCharset) {
                options.formAcceptCharset = options.form.attr('accept-charset');
            }
        },

        _getAJAXSettings: function(data) {
            var options = $.extend({}, this.options, data);
            this._initFormSettings(options, data);
            this._initDataSettings(options);

            return options;
        },

        // jQuery 1.6 doesn't provide .state(),
        // while jQuery 1.8+ removed .isRejected() and .isResolved():
        _getDeferredState: function(deferred) {
            if (deferred.state) {
                return deferred.state();
            }
            if (deferred.isResolved()) {
                return 'resolved';
            }
            if (deferred.isRejected()) {
                return 'rejected';
            }
            return 'pending';
        },

        // Maps jqXHR callbacks to the equivalent
        // methods of the given Promise object:
        _enhancePromise: function(promise) {
            promise.success = promise.done;
            promise.error = promise.fail;
            promise.complete = promise.always;
            return promise;
        },

        // Creates and returns a Promise object enhanced with
        // the jqXHR methods abort, success, error and complete:
        _getXHRPromise: function(resolveOrReject, context, args) {
            var dfd = $.Deferred(),
                promise = dfd.promise();
            context = context || this.options.context || promise;
            if (resolveOrReject === true) {
                dfd.resolveWith(context, args);
            } else if (resolveOrReject === false) {
                dfd.rejectWith(context, args);
            }
            promise.abort = dfd.promise;
            return this._enhancePromise(promise);
        },

        // Adds convenience methods to the data callback argument:
        _addConvenienceMethods: function(e, data) {
            var that = this,
                getPromise = function(args) {
                    return $.Deferred().resolveWith(that, args).promise();
                };
            data.process = function(resolveFunc, rejectFunc) {
                if (resolveFunc || rejectFunc) {
                    data._processQueue = this._processQueue =
                        (this._processQueue || getPromise([this])).pipe(
                            function() {
                                if (data.errorThrown) {
                                    return $.Deferred()
                                        .rejectWith(that, [data]).promise();
                                }
                                return getPromise(arguments);
                            }
                        ).pipe(resolveFunc, rejectFunc);
                }
                return this._processQueue || getPromise([this]);
            };
            data.submit = function() {
                if (this.state() !== 'pending') {
                    data.jqXHR = this.jqXHR =
                        (that._trigger(
                            'submit',
                            $.Event('submit', {
                                delegatedEvent: e
                            }),
                            this
                        ) !== false) && that._onSend(e, this);
                }
                return this.jqXHR || that._getXHRPromise();
            };
            data.abort = function() {
                if (this.jqXHR) {
                    return this.jqXHR.abort();
                }
                this.errorThrown = 'abort';
                that._trigger('fail', null, this);
                return that._getXHRPromise(false);
            };
            data.state = function() {
                if (this.jqXHR) {
                    return that._getDeferredState(this.jqXHR);
                }
                if (this._processQueue) {
                    return that._getDeferredState(this._processQueue);
                }
            };
            data.processing = function() {
                return !this.jqXHR && this._processQueue && that
                    ._getDeferredState(this._processQueue) === 'pending';
            };
            data.progress = function() {
                return this._progress;
            };
            data.response = function() {
                return this._response;
            };
        },

        // Parses the Range header from the server response
        // and returns the uploaded bytes:
        _getUploadedBytes: function(jqXHR) {
            var range = jqXHR.getResponseHeader('Range'),
                parts = range && range.split('-'),
                upperBytesPos = parts && parts.length > 1 &&
                parseInt(parts[1], 10);
            return upperBytesPos && upperBytesPos + 1;
        },

        // Uploads a file in multiple, sequential requests
        // by splitting the file up in multiple blob chunks.
        // If the second parameter is true, only tests if the file
        // should be uploaded in chunks, but does not invoke any
        // upload requests:
        _chunkedUpload: function(options, testOnly) {
            options.uploadedBytes = options.uploadedBytes || 0;
            var that = this,
                file = options.files[0],
                fs = file.size,
                ub = options.uploadedBytes,
                mcs = options.maxChunkSize || fs,
                slice = this._blobSlice,
                dfd = $.Deferred(),
                promise = dfd.promise(),
                jqXHR,
                upload;
            if (!(this._isXHRUpload(options) && slice && (ub || mcs < fs)) ||
                options.data) {
                return false;
            }
            if (testOnly) {
                return true;
            }
            if (ub >= fs) {
                file.error = options.i18n('uploadedBytes');
                return this._getXHRPromise(
                    false,
                    options.context, [null, 'error', file.error]
                );
            }
            // The chunk upload method:
            upload = function() {
                // Clone the options object for each chunk upload:
                var o = $.extend({}, options),
                    currentLoaded = o._progress.loaded;
                o.blob = slice.call(
                    file,
                    ub,
                    ub + mcs,
                    file.type
                );
                // Store the current chunk size, as the blob itself
                // will be dereferenced after data processing:
                o.chunkSize = o.blob.size;
                // Expose the chunk bytes position range:
                o.contentRange = 'bytes ' + ub + '-' +
                    (ub + o.chunkSize - 1) + '/' + fs;
                // Process the upload data (the blob and potential form data):
                that._initXHRData(o);
                // Add progress listeners for this chunk upload:
                that._initProgressListener(o);
                jqXHR = ((that._trigger('chunksend', null, o) !== false && $.ajax(o)) ||
                        that._getXHRPromise(false, o.context))
                    .done(function(result, textStatus, jqXHR) {
                        ub = that._getUploadedBytes(jqXHR) ||
                            (ub + o.chunkSize);
                        // Create a progress event if no final progress event
                        // with loaded equaling total has been triggered
                        // for this chunk:
                        if (currentLoaded + o.chunkSize - o._progress.loaded) {
                            that._onProgress($.Event('progress', {
                                lengthComputable: true,
                                loaded: ub - o.uploadedBytes,
                                total: ub - o.uploadedBytes
                            }), o);
                        }
                        options.uploadedBytes = o.uploadedBytes = ub;
                        o.result = result;
                        o.textStatus = textStatus;
                        o.jqXHR = jqXHR;
                        that._trigger('chunkdone', null, o);
                        that._trigger('chunkalways', null, o);
                        if (ub < fs) {
                            // File upload not yet complete,
                            // continue with the next chunk:
                            upload();
                        } else {
                            dfd.resolveWith(
                                o.context, [result, textStatus, jqXHR]
                            );
                        }
                    })
                    .fail(function(jqXHR, textStatus, errorThrown) {
                        o.jqXHR = jqXHR;
                        o.textStatus = textStatus;
                        o.errorThrown = errorThrown;
                        that._trigger('chunkfail', null, o);
                        that._trigger('chunkalways', null, o);
                        dfd.rejectWith(
                            o.context, [jqXHR, textStatus, errorThrown]
                        );
                    });
            };
            this._enhancePromise(promise);
            promise.abort = function() {
                return jqXHR.abort();
            };
            upload();
            return promise;
        },

        _beforeSend: function(e, data) {
            if (this._active === 0) {
                // the start callback is triggered when an upload starts
                // and no other uploads are currently running,
                // equivalent to the global ajaxStart event:
                this._trigger('start');
                // Set timer for global bitrate progress calculation:
                this._bitrateTimer = new this._BitrateTimer();
                // Reset the global progress values:
                this._progress.loaded = this._progress.total = 0;
                this._progress.bitrate = 0;
            }
            // Make sure the container objects for the .response() and
            // .progress() methods on the data object are available
            // and reset to their initial state:
            this._initResponseObject(data);
            this._initProgressObject(data);
            data._progress.loaded = data.loaded = data.uploadedBytes || 0;
            data._progress.total = data.total = this._getTotal(data.files) || 1;
            data._progress.bitrate = data.bitrate = 0;
            this._active += 1;
            // Initialize the global progress values:
            this._progress.loaded += data.loaded;
            this._progress.total += data.total;
        },

        _onDone: function(result, textStatus, jqXHR, options) {
            var total = options._progress.total,
                response = options._response;
            if (options._progress.loaded < total) {
                // Create a progress event if no final progress event
                // with loaded equaling total has been triggered:
                this._onProgress($.Event('progress', {
                    lengthComputable: true,
                    loaded: total,
                    total: total
                }), options);
            }
            response.result = options.result = result;
            response.textStatus = options.textStatus = textStatus;
            response.jqXHR = options.jqXHR = jqXHR;
            this._trigger('done', null, options);

        },

        _onFail: function(jqXHR, textStatus, errorThrown, options) {
            var response = options._response;
            if (options.recalculateProgress) {
                // Remove the failed (error or abort) file upload from
                // the global progress calculation:
                this._progress.loaded -= options._progress.loaded;
                this._progress.total -= options._progress.total;
            }
            response.jqXHR = options.jqXHR = jqXHR;
            response.textStatus = options.textStatus = textStatus;
            response.errorThrown = options.errorThrown = errorThrown;
            this._trigger('fail', null, options);
        },

        _onAlways: function(jqXHRorResult, textStatus, jqXHRorError, options) {
            // jqXHRorResult, textStatus and jqXHRorError are added to the
            // options object via done and fail callbacks
            this._trigger('always', null, options);
        },

        _onSend: function(e, data) {
            var file_index;
            var that = this;
            var file = data.files[0];
            var trs = $("table").find("tr");
            var ee = e;
            var odata = data;
            
            //给总体进度条下面的提示div每次计算md5时给其增加一个guid的class，每次计算md5的提示时，都是显示在guid的class里面的，
            //以后隐藏总体进度条及其下方的提示时，可以去除这个guid的class提示，那么就不会出现上次计算超大型文件的md5的提示重新出现了,因为md5的计算时异步的，没法终止
            var guid = (function() {
                function S4() {
                    return (((1 + Math.random()) * 0x10000) | 0).toString(16).substring(1);
                }
                return (S4() + S4() + "-" + S4() + "-" + S4() + "-" + S4() + "-" + S4() + S4() + S4());
            })();
            $('#fileupload').find('.fileupload-progress').addClass('in');
            var globalProgressNode = $("#fileupload").find('.fileupload-progress');
            var extendedProgressNode = globalProgressNode.find('.progress-extended');
            extendedProgressNode.addClass(guid);

            if (file.webkitRelativePath === undefined){
                //如果文件的webkitrelativepath丢失，则在data.originalfile里寻找;如果不同文件夹下有同样的文件，此种方法有错误
                // for (var i = 0;i < data.originalFiles.length;i++){                   
                //  if (file.name == data.originalFiles[i].name){
                //      file.webkitRelativePath = data.originalFiles[i].webkitRelativePath;
                //  }   
                // }
                //直接获取事先储存在html页面中的file_path信息
                file.webkitRelativePath = file.file_path;
            }
            
            //如果file对象的index属性丢失，则重新赋值
            if (file.index===undefined){
                for (let index = 0; index < (trs.length); index++) {
                    //如果不同的文件夹下有相同的文件，此时不能仅以
                    if (file.webkitRelativePath == $(trs[index]).find("td").eq(0).find("span").eq(1).html()) {
                        file.index=index;
                        file_index=index;
                        break;
                    }
                }
            }
            

            //在文件上传时，隐藏掉取消按钮，此时的取消按钮没有作用，不会取消掉正在上传的文件，如果不隐藏，用户点击了，那么会出现记录显示上传失败，但是实际事件是上传成功的矛盾
            // $("table").find("tr").eq(file_index).find("td").eq(4).find("button").eq(1).attr("disabled","true");
            file.cancelButton.setAttribute("disabled","true");
            
            (function(file) {

                var blobSlice = File.prototype.slice || File.prototype.mozSlice || File.prototype.webkitSlice,
                    // file = this.files[0],
                    chunkSize = 2097152, // Read in chunks of 2MB
                    chunks = Math.ceil(file.size / chunkSize),
                    currentChunk = 0,
                    spark = new SparkMD5.ArrayBuffer(),
                    fileReader = new FileReader();

                fileReader.onload = function(e) {
                    spark.append(e.target.result); // Append array buffer
                    currentChunk++;

                    var total_trs = $("table").find("tr").length - 1;
                    var success_trs = $("td .success_upload_count").length; //  
                    var tmp_md5;
                    var $that = $("#fileupload"),
                        progress = Math.floor((success_trs / total_trs) * 100),
                        globalProgressNode = $("#fileupload").find('.fileupload-progress'),
                        extendedProgressNode = globalProgressNode
                        .find('.' + guid);
                    var md5_progress = Math.floor((currentChunk / chunks) * 100);

                    extendedProgressNode.html(
                        file.name + "  正在处理，请稍等," + "已完成" + md5_progress + "%"
                    );

                    globalProgressNode
                        .find('.progress')
                        .attr('aria-valuenow', progress)
                        .children().first().css(
                            'width',
                            progress + '%'
                        );

                    if (currentChunk < chunks) {
                        loadNext();
                    } else {
                        tmp_md5 = spark.end();
                        var options = $.extend({}, this.options, data);
                            
                        var product_id = $("#sel_plan_product").find("option:selected").val();
                        var current_user_id = $("#current_user_id").text();
                        data.paramName = product_id + "\|" + file.webkitRelativePath + "\|" + tmp_md5 + "\*"+ current_user_id;

                        var msg = {};
                        msg.file_md5 = tmp_md5;
                        msg.file_path = file.webkitRelativePath;
                        msg.product_id = product_id;
                        msg.current_user_id = current_user_id;
                        var md5_exits = false;
                        $.ajax({
                            type: "post", //post提交方式默认是get
                            url: "/check_file_md5",
                            data: msg,
                            error: function(error) {

                                hiAlert("系统出现异常，请联系管理员");
                                //GLOBAL_IS_CONNECT[file.name] = false;这里不需要添加false的键值对，失败后点击每一行的cancle button,触发fail事件，由于
                                //file.name --true 键值对不存在，fail函数写入给file对象没status属性，故html fileupload 脚本渲染这一条上传记录为失败
                                // $("table").find("tr").eq(file_index).find("td").eq(4).find("button").eq(1).removeAttr("disabled");
                                // var td = $("table").find("tr").eq(file_index).find("td").eq(4).find("button").eq(1).click();
                                file.cancelButton.removeAttribute("disabled");
                                file.cancelButton.click();

                                //md5计算完毕后，跟服务器端核对md5时，与服务器失去连接，这里置上传文件为失败;同时解除该产品的上传状态限制
                                var product_id=$("#sel_plan_product").find("option:selected").val();
                                var current_user_id=$("#current_user_id").text();
                                $.ajax({
                                    type: "post", //post提交方式默认是get
                                    url: "/setUserRightInUploadTestCase"+"?product_id="+product_id+"&current_user_id="+current_user_id+"&uploadtest_status="+0,
                                    error: function(error) {
                                        hiAlert("系统错误，未恢复该产品上传状态")
                                    },
                                    success: function(response) {
                                    }
                                });
                            },
                            success: function(response, textStatus) {
                                if (response === "0") {
                                    if (!data.submit) {
                                        this._addConvenienceMethods(e, data);
                                    }

                                    var jqXHR,
                                        aborted,
                                        slot,
                                        pipe,
                                        options = that._getAJAXSettings(data),
                                        send = function() {
                                            that._sending += 1;
                                            // Set timer for bitrate progress calculation:
                                            options._bitrateTimer = new that._BitrateTimer();
                                            jqXHR = jqXHR || (
                                                ((aborted || that._trigger(
                                                        'send',
                                                        $.Event('send', {
                                                            delegatedEvent: e
                                                        }),
                                                        options
                                                    ) === false) &&
                                                    that._getXHRPromise(false, options.context, aborted)) ||
                                                that._chunkedUpload(options) || $.ajax(options)
                                            ).done(function(result, textStatus, jqXHR) {
                                                that._onDone(result, textStatus, jqXHR, options);
                                            }).fail(function(jqXHR, textStatus, errorThrown) {
                                                that._onFail(jqXHR, textStatus, errorThrown, options);
                                            }).always(function(jqXHRorResult, textStatus, jqXHRorError) {
                                                that._onAlways(
                                                    jqXHRorResult,
                                                    textStatus,
                                                    jqXHRorError,
                                                    options
                                                );
                                                that._sending -= 1;
                                                that._active -= 1;
                                                if (options.limitConcurrentUploads &&
                                                    options.limitConcurrentUploads > that._sending) {
                                                    // Start the next queued upload,
                                                    // that has not been aborted:
                                                    var nextSlot = that._slots.shift();
                                                    while (nextSlot) {
                                                        if (that._getDeferredState(nextSlot) === 'pending') {
                                                            nextSlot.resolve();
                                                            break;
                                                        }
                                                        nextSlot = that._slots.shift();
                                                    }
                                                }
                                                if (that._active === 0) {
                                                    // The stop callback is triggered when all uploads have
                                                    // been completed, equivalent to the global ajaxStop event:
                                                    that._trigger('stop');
                                                }
                                            });

                                            return jqXHR;
                                        };
                                    that._beforeSend(e, options);
                                    if (that.options.sequentialUploads ||
                                        (that.options.limitConcurrentUploads &&
                                            that.options.limitConcurrentUploads <= that._sending)) {
                                        if (that.options.limitConcurrentUploads > 1) {
                                            slot = $.Deferred();
                                            that._slots.push(slot);
                                            pipe = slot.pipe(send);
                                        } else {
                                            that._sequence = that._sequence.pipe(send, send);
                                            pipe = that._sequence;
                                        }
                                        // Return the piped Promise object, enhanced with an abort method,
                                        // which is delegated to the jqXHR object of the current upload,
                                        // and jqXHR callbacks mapped to the equivalent Promise methods:
                                        pipe.abort = function() {
                                            aborted = [undefined, 'abort', 'abort'];
                                            if (!jqXHR) {
                                                if (slot) {
                                                    slot.rejectWith(options.context, aborted);
                                                }
                                                return send();
                                            }
                                            return jqXHR.abort();
                                        };
                                        return that._enhancePromise(pipe);
                                    }
                                    return send();
                                } else if (response == "1") {
                                    //由于从服务器或者服务器已存在这个文件，所以我们让文件上传事件跳过实际发送文件阶段，直接跳到这里，并且点击cancle按钮，触发jquery.fileupload
                                    //-ui.js中的fail事件，在fail事件做其他判断。
                                    GLOBAL_IS_CONNECT[file.webkitRelativePath] = true;
                                    //恢复该产品的上传状态为可用
                                    var product_id=$("#sel_plan_product").find("option:selected").val();
                                    var current_user_id=$("#current_user_id").text();
                                    $.ajax({
                                        type: "post", //post提交方式默认是get
                                        url: "/setUserRightInUploadTestCase"+"?product_id="+product_id+"&current_user_id="+current_user_id+"&uploadtest_status="+0,
                                        error: function(error) {
                                            hiAlert("系统错误，未恢复该产品上传状态")
                                        },
                                        success: function(response) {
                                        }
                                    });
                                    //点击cancle按钮,触发jquery.fileupload-ui.js中fail事件，fail事件里会renderdownlown函数
                                    // $("table").find("tr").eq(file_index).find("td").eq(4).find("button").eq(1).removeAttr("disabled");
                                    // var td = $("table").find("tr").eq(file_index).find("td").eq(4).find("button").eq(1).click();
                                    file.cancelButton.removeAttribute("disabled");
                                    file.cancelButton.click();
                                }
                            }
                        });
                    }
                };

                fileReader.onloadend = function() {
                    //  callback(spark.end())
                }

                fileReader.onerror = function() {
                    console.warn('oops, something went wrong.');
                };

                function loadNext() {
                    var start = currentChunk * chunkSize,
                        end = ((start + chunkSize) >= file.size) ? file.size : start + chunkSize;

                    fileReader.readAsArrayBuffer(blobSlice.call(file, start, end));
                }
                loadNext();
            })(file);
        },

        _onAdd: function(e, data) {
            $('#btnallupload').removeAttr("disabled");
            $('#fileupload').find('.fileupload-progress').removeClass('in');
            $('#fileupload').find('.progress')
                .attr('aria-valuenow', '0')
                .children().first().css('width', '0%');
            $('#fileupload').find('.progress-extended').html("");
            if (($('#fileupload').find('.table')[0].rows.length > 1)) {
                return;
            }
            GLOBAL_IS_CONNECT = {};//下次上传文件开始，清空对象
            var extendedProgressNode = $("#fileupload").find('.fileupload-progress').find('.progress-extended');
            extendedProgressNode.removeClass();
            extendedProgressNode.addClass("progress-extended");

            var that = this,
                result = true,
                options = $.extend({}, this.options, data),

                files = data.files,
                filesLength = files.length,
                limit = options.limitMultiFileUploads,
                limitSize = options.limitMultiFileUploadSize,
                overhead = options.limitMultiFileUploadSizeOverhead,
                batchSize = 0,
                // product_id = this._getParamName(options).pop(),//从fileinput属性name中获取，
                //因为用例管理页面和上传用例页面的select同步了，如果进入上传用例页面，没有点击select，会导致name属性为空
                product_id = $("#sel_plan_product").find("option:selected").val(),//现在改为直接从select选中的option中取得productid  
                paramName = [],
                paramNameSet,
                paramNameSlice,
                fileSet,
                i,
                j = 0;

            var msg = {};
            msg.product_id = product_id;
            var testcase_files = [];
            var testcase_file_name = [];
            var testcase_files = Array.prototype.filter.call(data.files, function(file) {
                if (file.name.substring((file.name.lastIndexOf(".") + 1)) == "py" && 
                    file.webkitRelativePath && file.webkitRelativePath.includes('testcase')){
                    return file;
                }
            });

            if (testcase_files.length > 0) {
                var testcase_file_name = Array.prototype.map.call(testcase_files, function(file) {
                    if (file.name.substring((file.name.lastIndexOf(".") + 1)) == "py")
                        return file.name;
                });

                var testcase_file_sizes = Array.prototype.map.call(testcase_files, function(file) {
                    if (file.name.substring((file.name.lastIndexOf(".") + 1)) == "py") {
                        return file.size;
                    }
                });

                var total_testcase_file_sizes = Array.prototype.reduce.call(testcase_file_sizes, function(f1, f2) {

                    return parseInt(f1) + parseInt(f2);
                });

            }

            msg.casesname = testcase_file_name.toString();
            // var timeout = total_testcase_file_sizes / 2097152 * 1000;
            // console.log(timeout/1000);
            // if (timeout < 500) {
            //  timeout = 500;
            // }
            if (files.length > 300)
            {
                hiAlert('添加文件过多，请稍等','提示')
            }

            var testcase_file_md5 = [];
            if (testcase_files.length != 0){
            //增加上传的文件中没有py文件的判定
	            for (let i = 0; i < testcase_files.length; i++) {
	                var file = testcase_files[i];

	                (function() {
	                    var blobSlice = File.prototype.slice || File.prototype.mozSlice || File.prototype.webkitSlice,
	                        // file = this.files[0],
	                        chunkSize = 2097152, // Read in chunks of 2MB
	                        chunks = Math.ceil(file.size / chunkSize),
	                        currentChunk = 0,
	                        spark = new SparkMD5.ArrayBuffer(),
	                        fileReader = new FileReader();

	                    fileReader.onload = function(e) {
	                        // console.log('read chunk nr', currentChunk + 1, 'of', chunks);
	                        spark.append(e.target.result); // Append array buffer
	                        currentChunk++;

	                        if (currentChunk < chunks) {
	                            loadNext();
	                        } else {
	                            // console.log('finished loading');
	                            // console.info('computed hash', spark.end());  // Compute hash
	                            var temp_md5 = spark.end();
	                            testcase_file_md5.push(temp_md5);


	                            if (testcase_file_md5.length == testcase_files.length){

	                                (function() {
	                                    msg.testcase_file_md5 = testcase_file_md5.toString();
	                                    $.ajax({
	                                        type: "post", //post提交方式默认是get
	                                        url: "/get_product_casenames",
	                                        data: msg,
	                                        dataType: "json",
	                                        error: function(error) {
	                                            hiAlert("云测系统出现错误，请联系管理员");
	                                        },
	                                        success: function(response) {

	                                                for (var i = 0; i < data.files.length; i++) {
	                                                    if (data.files[i].name.substring((data.files[i].name.lastIndexOf(".") + 1)) == "py" && 
                                                            data.files[i].webkitRelativePath && data.files[i].webkitRelativePath.includes('testcase')) {
	                                                        if (data.files[i].name in response) {
	                                                            //针对.py文件，我们从服务器获取服务器上存不存在相应的文件，根据级别1,2,我们判断文件名，文件内容相不相同，根据这个级别，可以标红
	                                                            //testcase 名称相同，但是内容不同的文件，由html上upload脚本取exits_different属性判断
	                                                            data.files[i].index = i + 1;
	                                                            if (response[data.files[i].name] == "1") {
	                                                                data.files[i].exits_same = "True";

	                                                                data.files[i].status = "上传成功";

	                                                            } else if (response[data.files[i].name] == "2") {
	                                                                data.files[i].exits_different = "True";

	                                                                data.files[i].status = "上传成功";
	                                                            }
	                                                        }
	                                                    } else {
	                                                        data.files[i].index = i + 1;
	                                                    }

	                                                    if (i == data.files.length - 1) {
	                                                        if (!filesLength) {
	                                                            return false;
	                                                        }
	                                                        if (limitSize && files[0].size === undefined) {
	                                                            limitSize = undefined;
	                                                        }
	                                                        if (!(options.singleFileUploads || limit || limitSize) ||
	                                                            !that._isXHRUpload(options)) {
	                                                            fileSet = [files];
	                                                            paramNameSet = [paramName];
	                                                        } else if (!(options.singleFileUploads || limitSize) && limit) {
	                                                            fileSet = [];
	                                                            paramNameSet = [];
	                                                            for (i = 0; i < filesLength; i += limit) {
	                                                                fileSet.push(files.slice(i, i + limit));
	                                                                paramNameSlice = paramName.slice(i, i + limit);
	                                                                if (!paramNameSlice.length) {
	                                                                    paramNameSlice = paramName;
	                                                                }
	                                                                paramNameSet.push(paramNameSlice);
	                                                            }
	                                                        } else if (!options.singleFileUploads && limitSize) {
	                                                            fileSet = [];
	                                                            paramNameSet = [];
	                                                            for (i = 0; i < filesLength; i = i + 1) {
	                                                                batchSize += files[i].size + overhead;
	                                                                if (i + 1 === filesLength ||
	                                                                    ((batchSize + files[i + 1].size + overhead) > limitSize) ||
	                                                                    (limit && i + 1 - j >= limit)) {
	                                                                    fileSet.push(files.slice(j, i + 1));
	                                                                    paramNameSlice = paramName.slice(j, i + 1);
	                                                                    if (!paramNameSlice.length) {
	                                                                        paramNameSlice = paramName;
	                                                                    }
	                                                                    paramNameSet.push(paramNameSlice);
	                                                                    j = i + 1;
	                                                                    batchSize = 0;
	                                                                }
	                                                            }
	                                                        } else {
	                                                            paramNameSet = paramName;
	                                                        }
	                                                        data.originalFiles = files;
	                                                        $.each(fileSet || files, function(index, element) {
	                                                            var newData = $.extend({}, data);
	                                                            newData.files = fileSet ? element : [element];
	                                                            newData.paramName = paramNameSet[index];
	                                                            that._initResponseObject(newData);
	                                                            that._initProgressObject(newData);
	                                                            that._addConvenienceMethods(e, newData);
	                                                            result = that._trigger(
	                                                                'add',
	                                                                $.Event('add', {
	                                                                    delegatedEvent: e
	                                                                }),
	                                                                newData
	                                                            );

	                                                            return result;
	                                                        });
	                                                        return result;
	                                                    }
	                                                } //for
	                                            } //for ...if
	                                    })
	                                }());
	                            }
	                        }
	                    };

	                    fileReader.onerror = function() {
	                        console.warn('oops, something went wrong.');
	                    };

	                    function loadNext() {
	                        var start = currentChunk * chunkSize,
	                            end = ((start + chunkSize) >= file.size) ? file.size : start + chunkSize;

	                        fileReader.readAsArrayBuffer(blobSlice.call(file, start, end));
	                    }
	                    loadNext();
	                })()
	            }
	        }else{
        		for (var i = 0; i < data.files.length; i++) {                         
                    data.files[i].index = i + 1;
                         
	                if (i == data.files.length - 1) {
	                    if (!filesLength) {
	                        return false;
	                    }
	                    if (limitSize && files[0].size === undefined) {
	                        limitSize = undefined;
	                    }
	                    if (!(options.singleFileUploads || limit || limitSize) ||
	                        !that._isXHRUpload(options)) {
	                        fileSet = [files];
	                        paramNameSet = [paramName];
	                    } else if (!(options.singleFileUploads || limitSize) && limit) {
	                        fileSet = [];
	                        paramNameSet = [];
	                        for (i = 0; i < filesLength; i += limit) {
	                            fileSet.push(files.slice(i, i + limit));
	                            paramNameSlice = paramName.slice(i, i + limit);
	                            if (!paramNameSlice.length) {
	                                paramNameSlice = paramName;
	                            }
	                            paramNameSet.push(paramNameSlice);
	                        }
	                    } else if (!options.singleFileUploads && limitSize) {
	                        fileSet = [];
	                        paramNameSet = [];
	                        for (i = 0; i < filesLength; i = i + 1) {
	                            batchSize += files[i].size + overhead;
	                            if (i + 1 === filesLength ||
	                                ((batchSize + files[i + 1].size + overhead) > limitSize) ||
	                                (limit && i + 1 - j >= limit)) {
	                                fileSet.push(files.slice(j, i + 1));
	                                paramNameSlice = paramName.slice(j, i + 1);
	                                if (!paramNameSlice.length) {
	                                    paramNameSlice = paramName;
	                                }
	                                paramNameSet.push(paramNameSlice);
	                                j = i + 1;
	                                batchSize = 0;
	                            }
	                        }
	                    } else {
	                        paramNameSet = paramName;
	                    }
	                    data.originalFiles = files;
	                    $.each(fileSet || files, function(index, element) {
	                        var newData = $.extend({}, data);
	                        newData.files = fileSet ? element : [element];
	                        newData.paramName = paramNameSet[index];
	                        that._initResponseObject(newData);
	                        that._initProgressObject(newData);
	                        that._addConvenienceMethods(e, newData);
	                        result = that._trigger(
	                            'add',
	                            $.Event('add', {
	                                delegatedEvent: e
	                            }),
	                            newData
	                        );

	                        return result;
	                    });
	                    return result;
	                }
	            } //for
	        }
        },

        _replaceFileInput: function(data) {
            var input = data.fileInput,
                inputClone = input.clone(true),
                restoreFocus = input.is(document.activeElement);
            // Add a reference for the new cloned file input to the data argument:
            data.fileInputClone = inputClone;
            $('<form></form>').append(inputClone)[0].reset();
            // Detaching allows to insert the fileInput on another form
            // without loosing the file input value:
            input.after(inputClone).detach();
            // If the fileInput had focus before it was detached,
            // restore focus to the inputClone.
            if (restoreFocus) {
                inputClone.focus();
            }
            // Avoid memory leaks with the detached file input:
            $.cleanData(input.unbind('remove'));
            // Replace the original file input element in the fileInput
            // elements set with the clone, which has been copied including
            // event handlers:
            this.options.fileInput = this.options.fileInput.map(function(i, el) {
                if (el === input[0]) {
                    return inputClone[0];
                }
                return el;
            });
            // If the widget has been initialized on the file input itself,
            // override this.element with the file input clone:
            if (input[0] === this.element[0]) {
                this.element = inputClone;
            }

        },

        _handleFileTreeEntry: function(entry, path) {
            var that = this,
                dfd = $.Deferred(),
                errorHandler = function(e) {
                    if (e && !e.entry) {
                        e.entry = entry;
                    }
                    // Since $.when returns immediately if one
                    // Deferred is rejected, we use resolve instead.
                    // This allows valid files and invalid items
                    // to be returned together in one set:
                    dfd.resolve([e]);
                },
                successHandler = function(entries) {
                    that._handleFileTreeEntries(
                        entries,
                        path + entry.name + '/'
                    ).done(function(files) {
                        dfd.resolve(files);
                    }).fail(errorHandler);
                },
                readEntries = function() {
                    dirReader.readEntries(function(results) {
                        if (!results.length) {
                            successHandler(entries);
                        } else {
                            entries = entries.concat(results);
                            readEntries();
                        }
                    }, errorHandler);
                },
                dirReader, entries = [];
            path = path || '';
            if (entry.isFile) {
                if (entry._file) {
                    // Workaround for Chrome bug #149735
                    entry._file.relativePath = path;
                    dfd.resolve(entry._file);
                } else {
                    entry.file(function(file) {
                        file.relativePath = path;
                        dfd.resolve(file);
                    }, errorHandler);
                }
            } else if (entry.isDirectory) {
                dirReader = entry.createReader();
                readEntries();
            } else {
                // Return an empy list for file system items
                // other than files or directories:
                dfd.resolve([]);
            }
            return dfd.promise();
        },

        _handleFileTreeEntries: function(entries, path) {
            var that = this;
            return $.when.apply(
                $,
                $.map(entries, function(entry) {
                    return that._handleFileTreeEntry(entry, path);
                })
            ).pipe(function() {
                return Array.prototype.concat.apply(
                    [],
                    arguments
                );
            });
        },

        _getDroppedFiles: function(dataTransfer) {
            dataTransfer = dataTransfer || {};
            var items = dataTransfer.items;
            if (items && items.length && (items[0].webkitGetAsEntry ||
                    items[0].getAsEntry)) {
                return this._handleFileTreeEntries(
                    $.map(items, function(item) {
                        var entry;
                        if (item.webkitGetAsEntry) {
                            entry = item.webkitGetAsEntry();
                            if (entry) {
                                // Workaround for Chrome bug #149735:
                                entry._file = item.getAsFile();
                            }
                            return entry;
                        }
                        return item.getAsEntry();
                    })
                );
            }
            return $.Deferred().resolve(
                $.makeArray(dataTransfer.files)
            ).promise();
        },

        _getSingleFileInputFiles: function(fileInput) {
            fileInput = $(fileInput);
            var check_files = new Set();
            var relative_root_file_path ="";
            var filter_file = [];
            var entries = fileInput.prop('webkitEntries') ||
                fileInput.prop('entries'),
                files,
                value;
            if (entries && entries.length) {
                return this._handleFileTreeEntries(entries);
            }
            files = $.makeArray(fileInput.prop('files'));
            if (!files.length) {
                value = fileInput.prop('value');
                if (!value) {
                    return $.Deferred().resolve([]).promise();
                }
                // If the files property is not available, the browser does not
                // support the File API and we add a pseudo File object with
                // the input value as name with path information removed:
                files = [{
                    name: value.replace(/^.*\\/, '')
                }];
            } else if (files[0].name === undefined && files[0].fileName) {
                // File normalization for Safari 4 and Firefox 3:
                $.each(files, function(index, file) {
                    file.name = file.fileName;
                    file.size = file.fileSize;
                });
            }

            files.forEach(function(file,i) {
                //过滤input选择框选中的文件
                var file_path = file.webkitRelativePath.substring(0, file.webkitRelativePath.lastIndexOf("/"));
                var filename_suffix = file.name.substring(file.name.lastIndexOf(".")+1)
                //根据/来判断testcase，apk，resource是否处于二级或者一级目录，系统只添加这两种情况
                if (file_path.includes("testcase")) {
                    check_files.add("testcase");
                    relative_root_file_path = file_path.substring(0, file_path.indexOf("testcase"))
                } else if (file_path.includes("apk")) {
                    check_files.add("apk");
                    relative_root_file_path = file_path.substring(0, file_path.indexOf("apk"))
                } else if (file_path.includes("resource")) {
                    check_files.add("resource");
                    relative_root_file_path = file_path.substring(0, file_path.indexOf("resource"));
                }
                if (relative_root_file_path.lastIndexOf("/") == relative_root_file_path.indexOf("/")){
                    //只允许添加apk路径下的文件后缀为apk或者jar格式的文件
                    if (file_path.includes("apk") && (filename_suffix == "apk" || filename_suffix == "jar")){
                        filter_file.push(file);
                    }
                    //只允许添加testcase路径下的文件后缀为py格式的文件
                    if (file_path.includes("testcase") && filename_suffix == "py"){
                        if (file.name!="util.py") {
                        //如果文件名不是"util.py"，添加到上传文件中
                            filter_file.push(file);
                        }           
                    }
                    if (file_path.includes("resource")){
                        filter_file.push(file);
                    }
                }else{
                    hiAlert("testcase，apk，resource文件不是处于一级或者二级目录","提示");
                    return $.Deferred().resolve([]).promise();
                }
            })
            if (check_files.size < 1) {
                hiAlert("选择的文件夹不是或者不包含testcase，apk，resource文件夹，\r\n请重新选择", "提示");
                return $.Deferred().resolve([]).promise();
            }
            // filter_file.sort(function(file_a, file_b) {
            //  return file_b.size - file_a.size
            // })
            return $.Deferred().resolve(filter_file).promise();
        },

        _getFileInputFiles: function(fileInput) {
            if (!(fileInput instanceof $) || fileInput.length === 1) {
                return this._getSingleFileInputFiles(fileInput);
            }
            return $.when.apply(
                $,
                $.map(fileInput, this._getSingleFileInputFiles)
            ).pipe(function() {
                return Array.prototype.concat.apply(
                    [],
                    arguments
                );
            });
        },

        _onChange: function(e) {
            var that = this,
                data = {
                    fileInput: $(e.target),
                    form: $(e.target.form)
                };

            this._getFileInputFiles(data.fileInput).always(function(files) {
                data.files = files;

                if (that.options.replaceFileInput) {
                    that._replaceFileInput(data);
                }

                if (that._trigger(
                        'change',
                        $.Event('change', {
                            delegatedEvent: e
                        }),
                        data
                    ) !== false) {
                    that._onAdd(e, data);
                }
            });
        },

        _onPaste: function(e) {
            var items = e.originalEvent && e.originalEvent.clipboardData &&
                e.originalEvent.clipboardData.items,
                data = {
                    files: []
                };
            if (items && items.length) {
                $.each(items, function(index, item) {
                    var file = item.getAsFile && item.getAsFile();
                    if (file) {
                        data.files.push(file);
                    }
                });
                if (this._trigger(
                        'paste',
                        $.Event('paste', {
                            delegatedEvent: e
                        }),
                        data
                    ) !== false) {
                    this._onAdd(e, data);
                }
            }
        },

        _onDrop: function(e) {
            e.dataTransfer = e.originalEvent && e.originalEvent.dataTransfer;
            var that = this,
                dataTransfer = e.dataTransfer,
                data = {};
            if (dataTransfer && dataTransfer.files && dataTransfer.files.length) {
                e.preventDefault();
                this._getDroppedFiles(dataTransfer).always(function(files) {
                    data.files = files;
                    if (that._trigger(
                            'drop',
                            $.Event('drop', {
                                delegatedEvent: e
                            }),
                            data
                        ) !== false) {
                        that._onAdd(e, data);
                    }
                });
            }
        },

        _onDragOver: getDragHandler('dragover'),

        _onDragEnter: getDragHandler('dragenter'),

        _onDragLeave: getDragHandler('dragleave'),

        _initEventHandlers: function() {
            if (this._isXHRUpload(this.options)) {
                this._on(this.options.dropZone, {
                    dragover: this._onDragOver,
                    drop: this._onDrop,
                    // event.preventDefault() on dragenter is required for IE10+:
                    dragenter: this._onDragEnter,
                    // dragleave is not required, but added for completeness:
                    dragleave: this._onDragLeave
                });
                this._on(this.options.pasteZone, {
                    paste: this._onPaste
                });
            }
            if ($.support.fileInput) {
                this._on(this.options.fileInput, {
                    change: this._onChange
                });
            }
        },

        _destroyEventHandlers: function() {
            this._off(this.options.dropZone, 'dragenter dragleave dragover drop');
            this._off(this.options.pasteZone, 'paste');
            this._off(this.options.fileInput, 'change');
        },

        _setOption: function(key, value) {
            var reinit = $.inArray(key, this._specialOptions) !== -1;
            if (reinit) {
                this._destroyEventHandlers();
            }
            this._super(key, value);
            if (reinit) {
                this._initSpecialOptions();
                this._initEventHandlers();
            }
        },

        _initSpecialOptions: function() {
            var options = this.options;
            if (options.fileInput === undefined) {
                options.fileInput = this.element.is('input[type="file"]') ?
                    this.element : this.element.find('input[type="file"]');
            } else if (!(options.fileInput instanceof $)) {
                options.fileInput = $(options.fileInput);
            }
            if (!(options.dropZone instanceof $)) {
                options.dropZone = $(options.dropZone);
            }
            if (!(options.pasteZone instanceof $)) {
                options.pasteZone = $(options.pasteZone);
            }
        },

        _getRegExp: function(str) {
            var parts = str.split('/'),
                modifiers = parts.pop();
            parts.shift();
            return new RegExp(parts.join('/'), modifiers);
        },

        _isRegExpOption: function(key, value) {
            return key !== 'url' && $.type(value) === 'string' &&
                /^\/.*\/[igm]{0,3}$/.test(value);
        },

        _initDataAttributes: function() {
            var that = this,
                options = this.options,
                data = this.element.data();
            // Initialize options set via HTML5 data-attributes:
            $.each(
                this.element[0].attributes,
                function(index, attr) {
                    var key = attr.name.toLowerCase(),
                        value;
                    if (/^data-/.test(key)) {
                        // Convert hyphen-ated key to camelCase:
                        key = key.slice(5).replace(/-[a-z]/g, function(str) {
                            return str.charAt(1).toUpperCase();
                        });
                        value = data[key];
                        if (that._isRegExpOption(key, value)) {
                            value = that._getRegExp(value);
                        }
                        options[key] = value;
                    }
                }
            );
        },

        _create: function() {
            this._initDataAttributes();
            this._initSpecialOptions();
            this._slots = [];
            this._sequence = this._getXHRPromise(true);
            this._sending = this._active = 0;
            this._initProgressObject(this);
            this._initEventHandlers();
        },

        // This method is exposed to the widget API and allows to query
        // the number of active uploads:
        active: function() {
            return this._active;
        },

        // This method is exposed to the widget API and allows to query
        // the widget upload progress.
        // It returns an object with loaded, total and bitrate properties
        // for the running uploads:
        progress: function() {
            return this._progress;
        },

        // This method is exposed to the widget API and allows adding files
        // using the fileupload API. The data parameter accepts an object which
        // must have a files property and can contain additional options:
        // .fileupload('add', {files: filesList});
        add: function(data) {
            var that = this;
            if (!data || this.options.disabled) {
                return;
            }
            if (data.fileInput && !data.files) {
                this._getFileInputFiles(data.fileInput).always(function(files) {
                    data.files = files;
                    that._onAdd(null, data);
                });
            } else {
                data.files = $.makeArray(data.files);
                this._onAdd(null, data);
            }
        },

        // This method is exposed to the widget API and allows sending files
        // using the fileupload API. The data parameter accepts an object which
        // must have a files or fileInput property and can contain additional options:
        // .fileupload('send', {files: filesList});
        // The method returns a Promise object for the file upload call.
        send: function(data) {
            if (data && !this.options.disabled) {
                if (data.fileInput && !data.files) {
                    var that = this,
                        dfd = $.Deferred(),
                        promise = dfd.promise(),
                        jqXHR,
                        aborted;
                    promise.abort = function() {
                        aborted = true;
                        if (jqXHR) {
                            return jqXHR.abort();
                        }
                        dfd.reject(null, 'abort', 'abort');
                        return promise;
                    };
                    this._getFileInputFiles(data.fileInput).always(
                        function(files) {
                            if (aborted) {
                                return;
                            }
                            if (!files.length) {
                                dfd.reject();
                                return;
                            }
                            data.files = files;
                            jqXHR = that._onSend(null, data);
                            jqXHR.then(
                                function(result, textStatus, jqXHR) {
                                    dfd.resolve(result, textStatus, jqXHR);
                                },
                                function(jqXHR, textStatus, errorThrown) {
                                    dfd.reject(jqXHR, textStatus, errorThrown);
                                }
                            );
                        }
                    );
                    return this._enhancePromise(promise);
                }
                data.files = $.makeArray(data.files);
                if (data.files.length) {
                    return this._onSend(null, data);
                }
            }

            return this._getXHRPromise(false, data && data.context);
        }

    });
}));