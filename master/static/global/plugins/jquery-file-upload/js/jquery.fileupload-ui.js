/*
 * jQuery File Upload User Interface Plugin
 * https://github.com/blueimp/jQuery-File-Upload
 *
 * Copyright 2010, Sebastian Tschan
 * https://blueimp.net
 *
 * Licensed under the MIT license:
 * http://www.opensource.org/licenses/MIT
 */

/* jshint nomen:false */
/* global define, require, window */

function testcase_info() {
	//提示有多少个重名且内容不一致的testcase，用在_renderpreview里
	var total_trs = $("table").find("tr").length - 1;
	var samename_testcase_trs = $("td .samename_testcase").length;
	globalProgressNode = $("#fileupload").find('.fileupload-progress'),
		extendedProgressNode = globalProgressNode
		.find('.progress-extended');

	if (samename_testcase_trs > 0) {
		$('#fileupload').find('.fileupload-progress').addClass('in');
		extendedProgressNode.html(
			'<font face="verdana" color="red">'+"该产品线下存在  " + samename_testcase_trs + "  个文件内容不一致的同名测试用例"+'</font>'
		);
	}
}

function success_count() {
	var total_trs = $("table").find("tr").length - 1;
	var success_trs = 0;
	// var success_trs = $("td .success_upload_count").length; //这里success_trs从0开始计数	
	for (var file in GLOBAL_IS_CONNECT){
		if (GLOBAL_IS_CONNECT[file] ===true){
			success_trs = success_trs +1;
		}
	}	 
	var $that = $("#fileupload"),
		progress = Math.floor((success_trs / total_trs) * 100),
		globalProgressNode = $("#fileupload").find('.fileupload-progress'),
		extendedProgressNode = globalProgressNode
		.find('.progress-extended');

	if (total_trs > 0) {
		$('#fileupload').find('.fileupload-progress').addClass('in');
	}
	extendedProgressNode.html(
		"已上传" + success_trs.toString() + "个文件，还剩" + (total_trs - success_trs).toString() + "个文件"
	);
	if (progress >= 100) {
		globalProgressNode
			.find('.progress').removeClass("active")
	} else {
		globalProgressNode
			.find('.progress').addClass("active")
	}
	globalProgressNode
		.find('.progress')
		.attr('aria-valuenow', progress)
		.children().first().css(
			'width',
			progress + '%'
		);
}

(function(factory) {
	'use strict';
	if (typeof define === 'function' && define.amd) {
		// Register as an anonymous AMD module:
		define([
			'jquery',
			'tmpl',
			'./jquery.fileupload-image',
			'./jquery.fileupload-audio',
			'./jquery.fileupload-video',
			'./jquery.fileupload-validate'
		], factory);
	} else if (typeof exports === 'object') {
		// Node/CommonJS:
		factory(
			require('jquery'),
			require('tmpl')
		);
	} else {
		// Browser globals:
		factory(
			window.jQuery,
			window.tmpl
		);
	}
}(function($, tmpl) {
	'use strict';

	$.blueimp.fileupload.prototype._specialOptions.push(
		'filesContainer',
		'uploadTemplateId',
		'downloadTemplateId'
	);

	// The UI version extends the file upload widget
	// and adds complete user interface interaction:
	$.widget('blueimp.fileupload', $.blueimp.fileupload, {

		options: {
			// By default, files added to the widget are uploaded as soon
			// as the user clicks on the start buttons. To enable automatic
			// uploads, set the following option to true:
			autoUpload: false,
			// The ID of the upload template:
			uploadTemplateId: 'template-upload',
			// The ID of the download template:
			downloadTemplateId: 'template-download',
			// // The container for the list of files. If undefined, it is set to
			// // an element with class "files" inside of the widget element:
			filesContainer: undefined,
			// By default, files are appended to the files container.
			// Set the following option to true, to prepend files instead:
			prependFiles: false,
			// The expected data type of the upload response, sets the dataType
			// option of the $.ajax upload requests:
			dataType: 'json',

			// Error and info messages:
			messages: {
				unknownError: 'Unknown error'
			},

			// Function returning the current number of files,
			// used by the maxNumberOfFiles validation:
			getNumberOfFiles: function() {
				return this.filesContainer.children()
					.not('.processing').length;
			},

			// Callback to retrieve the list of files from the server response:
			getFilesFromResponse: function(data) {
				if (data.result && $.isArray(data.result.files)) {
					return data.result.files;
				}
				return [];
			},

			// The add callback is invoked as soon as files are added to the fileupload
			// widget (via file input selection, drag & drop or add API call).
			// See the basic file upload widget for more information:
			add: function(e, data) {
				if (e.isDefaultPrevented()) {
					return false;
				}
				var $this = $(this),
					that = $this.data('blueimp-fileupload') ||
					$this.data('fileupload'),
					options = that.options;
				data.context = that._renderUpload(data.files)
					.data('data', data)
					.addClass('processing');
				options.filesContainer[
					options.prependFiles ? 'prepend' : 'append'
				](data.context);
				that._forceReflow(data.context);
				that._transition(data.context);
				data.process(function() {
					return $this.fileupload('process', data);
				}).always(function() {
					data.context.each(function(index) {
						$(this).find('.size').text(
							that._formatFileSize(data.files[index].size)
						);
					}).removeClass('processing');
					that._renderPreviews(data);
				}).done(function() {
					data.context.find('.start').prop('disabled', false);
					if ((that._trigger('added', e, data) !== false) &&
						(options.autoUpload || data.autoUpload) &&
						data.autoUpload !== false) {
						data.submit();
					}
				}).fail(function() {
					if (data.files.error) {
						data.context.each(function(index) {
							var error = data.files[index].error;
							if (error) {
								$(this).find('.error').text(error);
							}
						});
					}
				});
			},
			// Callback for the start of each file upload request:
			send: function(e, data) {
				if (e.isDefaultPrevented()) {
					return false;
				}
				var that = $(this).data('blueimp-fileupload') ||
					$(this).data('fileupload');
				if (data.context && data.dataType &&
					data.dataType.substr(0, 6) === 'iframe') {
					// Iframe Transport does not support progress events.
					// In lack of an indeterminate progress bar, we set
					// the progress to 100%, showing the full animated bar:
					// data.context
					//     .find('.progress').addClass(
					//         !$.support.transition && 'progress-animated'
					//     )
					//     .attr('aria-valuenow', 100)
					//     .children().first().css(
					//         'width',
					//         '100%'
					//     );
				}

				return that._trigger('sent', e, data);
			},
			// Callback for successful uploads:
			done: function(e, data) {
				if (e.isDefaultPrevented()) {
					return false;
				}
				//文件实际上传完毕后，会跳到这个函数里，在这里把产品的上传状态置为可用;
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

				var that = $(this).data('blueimp-fileupload') ||
					$(this).data('fileupload'),
					getFilesFromResponse = data.getFilesFromResponse ||
					that.options.getFilesFromResponse,
					files = getFilesFromResponse(data),
					template,
					deferred;
				if (data.context) {
					data.context.each(function(index) {
						var file = files[index] || {
							error: 'Empty file upload result'
						};

						file.index = data.files[0].index;						
						file.webkitRelativePath = data.files[0].webkitRelativePath;
												
						//文件上传成功后，将成功上传的文件路径名的状态在全局对象里置为true，用文件路径名唯一标识一个文件
						GLOBAL_IS_CONNECT[file.webkitRelativePath] = true;
						deferred = that._addFinishedDeferreds();
						that._transition($(this)).done(
							function() {
								var node = $(this);
								template = that._renderDownload([file])
									.replaceAll(node);
								that._forceReflow(template);
								that._transition(template).done(
									function() {
										data.context = $(this);
										that._trigger('completed', e, data);
										that._trigger('finished', e, data);
										deferred.resolve();

									}
								);
							}
						);
					});
				} else {
					template = that._renderDownload(files)[
						that.options.prependFiles ? 'prependTo' : 'appendTo'
					](that.options.filesContainer);
					that._forceReflow(template);
					deferred = that._addFinishedDeferreds();
					that._transition(template).done(
						function() {
							data.context = $(this);
							that._trigger('completed', e, data);
							that._trigger('finished', e, data);
							deferred.resolve();

						}
					);
				}

			},
			// Callback for failed (abort or error) uploads:
			fail: function(e, data) {

				if (e.isDefaultPrevented()) {
					return false;
				}

				/*点击form表格上的reset按钮和表格单条记录的cancel按钮，触发的fail，传递的data.paramName是undefined的，
				通过点击上传按钮，然后发送失败，触发fail，data数据的paramName则有
				*/
				//点击发送按钮后，如果我们因为md5相同而没有让上传文件正常发送，那么事件不会走到done，不会到done就不会触发html代码中渲染upload的脚本，所以
				//我们把done事件的代码放到下面,并且根据在点击start按钮对应触发_starthandler,我们添加的file.start 判断
				//事件是由于点击了开始上传后，触发上传失败事件，然后在jquery.fileupload.js中的__onsend最后我们做了点击cancle的事件，来让脚本跑到下面的代码
				//注意如果点击了清空添加文件，会导致data.files == undefined
				
				if (data.files !==undefined  && data.paramName !== undefined){
					if (data.files[0].start=="True"){
					// if (data.paramName !== undefined) {
						if (e.isDefaultPrevented()) {
							return false;
						}

						var that = $(this).data('blueimp-fileupload') ||
							$(this).data('fileupload'),
							getFilesFromResponse = data.getFilesFromResponse ||
							that.options.getFilesFromResponse,
							files = getFilesFromResponse(data),
							template,
							deferred;

						if (data.context) {
							data.context.each(function(index) {
								//这里file属性本应由成功上传后由服务器传过来，由于我们点击上传文件后，走的是fail事件，所以这里我们手动为html脚本要用到的file添加属性
								if (GLOBAL_IS_CONNECT[data.files[0].webkitRelativePath] === true){
									var file = {
										status: "上传成功",
										name: data.files[0].name,
										size: data.files[0].size,
										index: data.files[0].index
									};}else{
									var file = {
										name: data.files[0].name,
										size: data.files[0].size,
										index: data.files[0].index
									}
									//文件实际上传并且失败后，在这里把产品的上传状态置为可用;
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
								}

								if (file.index === undefined){
								//如果文件的webkitrelativepath丢失，则在data.originalfile里寻找
									for (var i = 0;i < data.originalFiles.length;i++){
										
										if (file.name == data.originalFiles[i].name){
											file.index = i+1;

										}	
									}
								}

								deferred = that._addFinishedDeferreds();
								that._transition($(this)).done(
									function() {
										var node = $(this);
										template = that._renderDownload([file])
											.replaceAll(node);
										that._forceReflow(template);
										that._transition(template).done(
											function() {
												data.context = $(this);
												that._trigger('completed', e, data);
												that._trigger('finished', e, data);
												deferred.resolve();

											}
										);
									}
								);
							});
						} else {
							template = that._renderDownload(files)[
								that.options.prependFiles ? 'prependTo' : 'appendTo'
							](that.options.filesContainer);
							that._forceReflow(template);
							deferred = that._addFinishedDeferreds();
							that._transition(template).done(
								function() {
									data.context = $(this);
									that._trigger('completed', e, data);
									that._trigger('finished', e, data);
									deferred.resolve();
								}
							);
						}
					}
				}

				$('#fileupload').find('.fileupload-progress').removeClass('in');
				$('#fileupload').find('.progress')
					.attr('aria-valuenow', '0')
					.children().first().css('width', '0%');
				$('#fileupload').find('.progress-extended').html("");

				var that = $(this).data('blueimp-fileupload') ||
					$(this).data('fileupload'),
					template,
					deferred;
				if (data.context) {
					data.context.each(function(index) {
						if (data.errorThrown !== 'abort') {
							var file = data.files[index];
							file.error = file.error || data.errorThrown ||
								data.i18n('unknownError');
							deferred = that._addFinishedDeferreds();
							that._transition($(this)).done(
								function() {
									var node = $(this);
									template = that._renderDownload([file])
										.replaceAll(node);
									that._forceReflow(template);
									that._transition(template).done(
										function() {
											data.context = $(this);
											that._trigger('failed', e, data);
											that._trigger('finished', e, data);
											deferred.resolve();
										}
									);
								}
							);
						} else {
							deferred = that._addFinishedDeferreds();
							that._transition($(this)).done(
								function() {
									$(this).remove();
									that._trigger('failed', e, data);
									that._trigger('finished', e, data);
									deferred.resolve();
								}
							);
						}
					});
				} else if (data.errorThrown !== 'abort') {
					data.context = that._renderUpload(data.files)[
							that.options.prependFiles ? 'prependTo' : 'appendTo'
						](that.options.filesContainer)
						.data('data', data);
					that._forceReflow(data.context);
					deferred = that._addFinishedDeferreds();
					that._transition(data.context).done(
						function() {
							data.context = $(this);
							that._trigger('failed', e, data);
							that._trigger('finished', e, data);
							deferred.resolve();
						}
					);
				} else {
					that._trigger('failed', e, data);
					that._trigger('finished', e, data);
					that._addFinishedDeferreds().resolve();
				}
			},

			// Callback for upload progress events:
			progress: function(e, data) {
				if (e.isDefaultPrevented()) {
					return false;
				}

				$('#fileupload').find('.fileupload-progress').addClass('in');
				var progress = Math.floor(data.loaded / data.total * 100);
				if (data.context) {
					data.context.each(function() {
						$(this).find('.progress')
							.attr('aria-valuenow', progress)
							.children().first().css(
								'width',
								progress + '%'
							);
					});
				} else if (data.loaded != 0) {
					data.context.each(function() {
						$(this).find('.progress')
							.attr('aria-valuenow', 0)
							.children().first().css(
								'width',
								progress + '%'
							);
					});
				}
			},
			// Callback for global upload progress events:
			progressall: function(e, data) {

				if (e.isDefaultPrevented()) {
					return false;
				}
				// success_count();
				// var $this = $(this),
				// 	progress = Math.floor(success_trs / total_trs * 100),
				// 	globalProgressNode = $this.find('.fileupload-progress'),
				// 	extendedProgressNode = globalProgressNode
				// 	.find('.progress-extended');
				// if (extendedProgressNode.length) {
				// 	extendedProgressNode.html(
				// 		($this.data('blueimp-fileupload') || $this.data('fileupload'))
				// 		._renderExtendedProgress(data)
				// 	);
				// }

				// globalProgressNode
				// 	.find('.progress')
				// 	.attr('aria-valuenow', progress)
				// 	.children().first().css(
				// 		'width',
				// 		progress + '%'
				// 	);

			},
			// Callback for uploads start, equivalent to the global ajaxStart event:
			start: function(e) {
				if (e.isDefaultPrevented()) {
					return false;
				}
				var that = $(this).data('blueimp-fileupload') ||
					$(this).data('fileupload');
				that._resetFinishedDeferreds();
				that._transition($(this).find('.fileupload-progress')).done(
					function() {
						that._trigger('started', e);
					}
				);
			},
			// Callback for uploads stop, equivalent to the global ajaxStop event:
			stop: function(e) {
				if (e.isDefaultPrevented()) {
					return false;
				}
				var that = $(this).data('blueimp-fileupload') ||
					$(this).data('fileupload'),
					deferred = that._addFinishedDeferreds();

				setTimeout(function() {
					var total_trs = $("table").find("tr").length - 1;
					var success_trs = $("td .success_upload_count").length;
					$.when.apply($, that._getFinishedDeferreds())
						.done(function() {
							that._trigger('stopped', e);
						});
					that._transition($(this).find('.fileupload-progress')).done(
						function() {
							$(this).find('.progress')
								.attr('aria-valuenow', '100')
								.children().first().css('width', '100%');
							$(this).find('.progress-extended').html("已上传" + success_trs.toString() + "个文件，还剩" + (total_trs - success_trs).toString() + "个文件");
							deferred.resolve();
						}
					);
				}, 1000);
			},
			processstart: function(e) {
				if (e.isDefaultPrevented()) {
					return false;
				}

				$(this).addClass('fileupload-processing');
			},
			processstop: function(e) {
				if (e.isDefaultPrevented()) {
					return false;
				}
				$(this).removeClass('fileupload-processing');
			},
			// Callback for file deletion:
			destroy: function(e, data) {
				if (e.isDefaultPrevented()) {
					return false;
				}
				var that = $(this).data('blueimp-fileupload') ||
					$(this).data('fileupload'),
					removeNode = function() {
						that._transition(data.context).done(
							function() {
								$(this).remove();
								that._trigger('destroyed', e, data);
							}
						);
					};
				if (data.url) {
					data.dataType = data.dataType || that.options.dataType;
					$.ajax(data).done(removeNode).fail(function() {
						that._trigger('destroyfailed', e, data);
					});
				} else {
					removeNode();
				}
			}

		},

		_resetFinishedDeferreds: function() {
			this._finishedUploads = [];
		},

		_addFinishedDeferreds: function(deferred) {
			if (!deferred) {
				deferred = $.Deferred();
			}
			this._finishedUploads.push(deferred);
			return deferred;
		},

		_getFinishedDeferreds: function() {
			return this._finishedUploads;
		},

		// Link handler, that allows to download files
		// by drag & drop of the links to the desktop:
		_enableDragToDesktop: function() {
			var link = $(this),
				url = link.prop('href'),
				name = link.prop('download'),
				type = 'application/octet-stream';
			link.bind('dragstart', function(e) {
				try {
					e.originalEvent.dataTransfer.setData(
						'DownloadURL', [type, name, url].join(':')
					);
				} catch (ignore) {}
			});
		},

		_formatFileSize: function(bytes) {
			if (typeof bytes !== 'number') {
				return '';
			}
			if (bytes >= 1000000000) {
				return (bytes / 1000000000).toFixed(2) + ' GB';
			}
			if (bytes >= 1000000) {
				return (bytes / 1000000).toFixed(2) + ' MB';
			}
			return (bytes / 1000).toFixed(2) + ' KB';
		},

		_formatBitrate: function(bits) {
			if (typeof bits !== 'number') {
				return '';
			}
			if (bits >= 1000000000) {
				return (bits / 1000000000).toFixed(2) + ' Gbit/s';
			}
			if (bits >= 1000000) {
				return (bits / 1000000).toFixed(2) + ' Mbit/s';
			}
			if (bits >= 1000) {
				return (bits / 1000).toFixed(2) + ' kbit/s';
			}
			return bits.toFixed(2) + ' bit/s';
		},

		_formatTime: function(seconds) {
			var date = new Date(seconds * 1000),
				days = Math.floor(seconds / 86400);
			days = days ? days + 'd ' : '';
			return days +
				('0' + date.getUTCHours()).slice(-2) + ':' +
				('0' + date.getUTCMinutes()).slice(-2) + ':' +
				('0' + date.getUTCSeconds()).slice(-2);
		},

		_formatPercentage: function(floatValue) {
			return (floatValue * 100).toFixed(2) + ' %';
		},

		_renderExtendedProgress: function(data) {
			return this._formatBitrate(data.bitrate) + ' | ' +
				this._formatTime(
					(data.total - data.loaded) * 8 / data.bitrate
				) + ' | ' +
				this._formatPercentage(
					data.loaded / data.total
				) + ' | ' +
				this._formatFileSize(data.loaded) + ' / ' +
				this._formatFileSize(data.total);
		},

		_renderTemplate: function(func, files) {

			if (!func) {
				return $();
			}
			var result = func({
				files: files,
				formatFileSize: this._formatFileSize,
				options: this.options
			});
			if (result instanceof $) {
				return result;
			}

			return $(this.options.templatesContainer).html(result).children();
		},

		_renderPreviews: function(data) {
			setTimeout(testcase_info(), 1000);
			data.context.find('.preview').each(function(index, elm) {
				$(elm).append(data.files[index].preview);
			});

		},

		_renderUpload: function(files) {
			return this._renderTemplate(
				this.options.uploadTemplate,
				files
			);
		},

		_renderDownload: function(files) {
			setTimeout(success_count(), 1000);
			return this._renderTemplate(
				this.options.downloadTemplate,
				files
			).find('a[download]').each(this._enableDragToDesktop).end();

		},
		//点击start按钮后，触发_startHandlerh
		_startHandler: function(e) {
			e.preventDefault();
			var file_path = e.currentTarget.parentNode.parentNode.firstChild.nextSibling.children[1].innerHTML;//获得实现存储在每一行记录中的file_path
			var cancelButton = e.currentTarget.nextElementSibling;//获得点击的上传按钮旁边的取消按钮			
			var product_id=$("#sel_plan_product").find("option:selected").val();
			var current_user_id=$("#current_user_id").text();
			var button = $(e.currentTarget);
			var template = button.closest('.template-upload');
			var data = template.data('data');
			if (GLOBAL_ALLFILEUPLOAD_FLAG == false){
				jQuery.ajax({
					type: "post", //post提交方式默认是get
					// data: msg, 这里data参数不能带，带上会引发Uncaught RangeError: Maximum call stack size exceeded，具体原因：https://bugs.jquery.com/ticket/12233
					url: "/getUserRightInUploadTestCase"+"?product_id="+product_id+"&current_user_id="+current_user_id,		
					async: false,
					error: function(error) {
						hiAlert("获取产品线上传状态失败，请联系管理员", "提示");
						return false;
					},
					success: function(response, textStatus, jqXHR) {
						
						if (response == "0") {
							$.ajax({
								type: "post", //post提交方式默认是get
								url: "/setUserRightInUploadTestCase"+"?product_id="+product_id+"&current_user_id="+current_user_id+"&uploadtest_status="+1,
								error: function(error) {
									hiAlert("获取产品线上传状态失败，请联系管理员", "提示");
				                            		return false;
								},
								success: function(response) {
									
									data.files[0].start = "True"; //作用为文件md5相同后，浏览器不发送文件，点击取消按钮后，触发fail事件，通过这个start属性来给文件添加file.status
									data.files[0].cancelButton=cancelButton;//方便点击上传按钮后，实际不发送文件，然后点击取消按钮，触发fail事件
									data.files[0].file_path=file_path;//某种情况下，文件对象传递到_onsend函数里会丢失file.webkitRelativePath，file_path可以代替丢失的属性
									button.prop('disabled', true);
									if (data && data.submit) {
										data.submit();
									}
								}
							});
						} else if(response =="1") {
							hiAlert("请稍等，此产品线正在上传用例", "提示");
							return;
						}
					}
				});
			}else {
				
				if (GLOBAL_FILECANUPLOAD_FLAG){
					data.files[0].start = "True"; //作用为文件md5相同后，浏览器不发送文件，点击取消按钮后，触发fail事件，通过这个start属性来给文件添加file.status
					data.files[0].cancelButton=cancelButton;//方便点击上传按钮后，实际不发送文件，然后点击取消按钮，触发fail事件
					data.files[0].file_path=file_path;//某种情况下，文件对象传递到_onsend函数里会丢失file.webkitRelativePath，file_path可以代替丢失的属性
					button.prop('disabled', true);
					if (data && data.submit) {
						data.submit();
					}
				}else{
					setTimeout(
						function(){
							if (GLOBAL_FILECANUPLOAD_FLAG){
								data.files[0].start = "True"; //作用为文件md5相同后，浏览器不发送文件，点击取消按钮后，触发fail事件，通过这个start属性来给文件添加file.status
								data.files[0].cancelButton=cancelButton;//方便点击上传按钮后，实际不发送文件，然后点击取消按钮，触发fail事件
								data.files[0].file_path=file_path;//某种情况下，文件对象传递到_onsend函数里会丢失file.webkitRelativePath，file_path可以代替丢失的属性
								button.prop('disabled', true);
								if (data && data.submit) {
									data.submit();
								}
							}
						},
					2000)
				}
			}
		},

		// _startHandler: function(e) {
		// 	e.preventDefault();
		// 	return false;

		// 	var button = $(e.currentTarget),
		// 		template = button.closest('.template-upload'),
		// 		data = template.data('data');
		// 		data.files[0].start = "True"; 
		// 	button.prop('disabled', true);
		// 	if (data && data.submit) {
		// 		data.submit();
		// 	}
		// },

		_cancelHandler: function(e) {
			e.preventDefault();
			var template = $(e.currentTarget)
				.closest('.template-upload,.template-download'),
				data = template.data('data') || {};				
			data.context = data.context || template;
			if (data.abort) {
				data.abort();
			} else {
				data.errorThrown = 'abort';
				this._trigger('fail', e, data);
			}
		},

		_deleteHandler: function(e) {
			e.preventDefault();
			var button = $(e.currentTarget);
			this._trigger('destroy', e, $.extend({
				context: button.closest('.template-download'),
				type: 'DELETE'
			}, button.data()));
		},

		_forceReflow: function(node) {

			return $.support.transition && node.length &&
				node[0].offsetWidth;
		},

		_transition: function(node) {
			var dfd = $.Deferred();
			if ($.support.transition && node.hasClass('fade') && node.is(':visible')) {
				node.bind(
					$.support.transition.end,
					function(e) {
						// Make sure we don't respond to other transitions events
						// in the container element, e.g. from button elements:
						if (e.target === node[0]) {
							node.unbind($.support.transition.end);
							dfd.resolveWith(node);
						}
					}
				).toggleClass('in');
			} else {
				node.toggleClass('in');
				dfd.resolveWith(node);
			}
			return dfd;
		},

		_initButtonBarEventHandlers: function() {
			var fileUploadButtonBar = this.element.find('.fileupload-buttonbar'),
				filesList = this.options.filesContainer;
			this._on(fileUploadButtonBar.find('.start'), {
				click: function(e) {
					e.preventDefault();
					filesList.find('.start').click();
				}
			});
			this._on(fileUploadButtonBar.find('.cancel'), {
				click: function(e) {
					e.preventDefault();
					filesList.find('.cancel').click();
				}
			});
			this._on(fileUploadButtonBar.find('.delete'), {
				click: function(e) {
					e.preventDefault();
					filesList.find('.toggle:checked')
						.closest('.template-download')
						.find('.delete').click();
					fileUploadButtonBar.find('.toggle')
						.prop('checked', false);
				}
			});
			this._on(fileUploadButtonBar.find('.toggle'), {
				change: function(e) {
					filesList.find('.toggle').prop(
						'checked',
						$(e.currentTarget).is(':checked')
					);
				}
			});
		},

		_destroyButtonBarEventHandlers: function() {
			this._off(
				this.element.find('.fileupload-buttonbar')
				.find('.start, .cancel, .delete'),
				'click'
			);
			this._off(
				this.element.find('.fileupload-buttonbar .toggle'),
				'change.'
			);
		},

		_initEventHandlers: function() {
			this._super();
			this._on(this.options.filesContainer, {
				'click .start': this._startHandler,
				'click .cancel': this._cancelHandler,
				'click .delete': this._deleteHandler
			});
			this._initButtonBarEventHandlers();
		},

		_destroyEventHandlers: function() {
			this._destroyButtonBarEventHandlers();
			this._off(this.options.filesContainer, 'click');
			this._super();
		},

		_enableFileInputButton: function() {
			this.element.find('.fileinput-button input')
				.prop('disabled', false)
				.parent().removeClass('disabled');

		},

		_disableFileInputButton: function() {
			this.element.find('.fileinput-button input')
				.prop('disabled', true)
				.parent().addClass('disabled');
		},

		_initTemplates: function() {
			var options = this.options;
			options.templatesContainer = this.document[0].createElement(
				options.filesContainer.prop('nodeName')
			);
			if (tmpl) {
				if (options.uploadTemplateId) {
					options.uploadTemplate = tmpl(options.uploadTemplateId);
				}
				if (options.downloadTemplateId) {
					options.downloadTemplate = tmpl(options.downloadTemplateId);
				}
			}
		},

		_initFilesContainer: function() {
			var options = this.options;
			if (options.filesContainer === undefined) {
				options.filesContainer = this.element.find('.files');
			} else if (!(options.filesContainer instanceof $)) {
				options.filesContainer = $(options.filesContainer);
			}
		},

		_initSpecialOptions: function() {
			this._super();
			this._initFilesContainer();
			this._initTemplates();
		},

		_create: function() {
			this._super();
			this._resetFinishedDeferreds();
			if (!$.support.fileInput) {
				this._disableFileInputButton();
			}
		},

		enable: function() {

			var wasDisabled = false;
			if (this.options.disabled) {
				wasDisabled = true;
			}
			this._super();
			if (wasDisabled) {
				this.element.find('input, button').prop('disabled', false);
				this._enableFileInputButton();
			}
		},

		disable: function() {
			if (!this.options.disabled) {
				this.element.find('input, button').prop('disabled', true);
				this._disableFileInputButton();
			}
			this._super();
		}

	});

}));