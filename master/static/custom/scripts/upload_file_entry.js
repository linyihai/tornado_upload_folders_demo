;jQuery.extend({
    Device_Flash_Fireware_Global_Args:{
    GLOBAL_FILECANUPLOAD_FLAG:false,
    GLOBAL_ALLFILEUPLOAD_FLAG:false,
    GLOBAL_IS_FILE_UPLOAD_SUCCESS:{}//一个全局变量记录了每个文件上传成功或者失败;在点击添加文件夹按钮后清空该对象,key为file的webkitpath
    }
});
var FormFileUpload = function() {
  
    return {
        //main function to initiate the module
        init: function() {

            // Initialize the jQuery File Upload widget:
            $('#fileupload').fileupload({
                disableImageResize: false,
                autoUpload: false,
                disableImageResize: /Android(?!.*Chrome)|Opera/.test(window.navigator.userAgent),
                maxFileSize: 5000000000000000000000000000000000000000,
                // acceptFileTypes: /(\.|\/)(gif|jpe?g|png|py)$/i,
                // Uncomment the following to send cross-domain cookies:
                //xhrFields: {withCredentials: true},                
            });

            // Enable iframe cross-domain access via redirect option:
            $('#fileupload').fileupload(
                'option',
                'redirect',
                window.location.href.replace(
                    /\/[^\/]*$/,
                    '/cors/result.html?%s'
                )
            );

            //阻止右键弹出菜单功能
            // $(document).ready(function() {
            //  $(document).bind("contextmenu", function(e) {
            //      return false;
            //  });
            // });

            //限制页面F5键刷新
            $(document).bind("keydown", function(e) {
                var e = window.event || e;
                if (e.keyCode == 116) {
                    e.keyCode = 0;
                    return false;
                }
            });

            $('#fileinput').on('click', '', function(e) {
                if ($('#fileupload').find('.table')[0].rows.length > 1) {
                    hiAlert("此页面还有待处理的文件，请点击开始上传或者清空添加文件按钮，然后继续操作", "提示");
                    $("#pulsate-once-target").pulsate({
                        color: "#399bc3",
                        repeat: 3
                    })
                    e.preventDefault();
                    return;
                }
            });

            $('#btnallupload').on('mousemove', '', function(e) {
                jQuery.Device_Flash_Fireware_Global_Args["GLOBAL_ALLFILEUPLOAD_FLAG"] = true;
                jQuery.Device_Flash_Fireware_Global_Args["GLOBAL_FILECANUPLOAD_FLAG"] = false;

            });

            $('#btnallupload').on('mouseout', '', function(e) {                          
                jQuery.Device_Flash_Fireware_Global_Args["GLOBAL_ALLFILEUPLOAD_FLAG"] = false;
            });

            $('#btnallupload').on('click', '', function(e) {
                var event = e;
                var trs_count = $("#table_upload_file").find("tr").length - 1;
                var allfileupload_count=$("table").find("tr").find("span:contains(上传)").length;
                if (!(trs_count == 0 || allfileupload_count == 0)){     
                    jQuery.Device_Flash_Fireware_Global_Args["GLOBAL_ALLFILEUPLOAD_FLAG"] = true;                                   
                    $('#btnallupload').attr("disabled", "true");
                }
            });
        }
    };
}();
jQuery(document).ready(function() {
    FormFileUpload.init();
});