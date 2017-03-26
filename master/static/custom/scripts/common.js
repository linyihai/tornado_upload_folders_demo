/**
 * 创建Form表单	 
 * @param config Object
 *  <p>url:form的Action，提交的后台地址</p>
 *  <p>method:使用POST还是GET提交表单</p>
 *  <p>params:参数 K-V</p>
 * @return Form
 * 
 * 设置页面是否跳转*
 * form.target = "_blank"; 	
 */

(function() {
    //设置命名空间	
    var FormSTD = window.FormSTD || {};
    window.FormSTD = FormSTD;

    FormSTD.form = function(config) {
        config = config || {};

        var url = config.url,
            method = config.method || 'GET',
            params = config.params || {};

        var form = document.createElement('form');
        form.action = url;
        form.method = method;

        for(var param in params) {
            var value = params[param],
                inputs = document.createElement('input');

            inputs.type = 'hidden';
            inputs.name = param;
            inputs.value = value;

            form.appendChild(inputs);
        }

        return form;
    }

})()

function locationHrefFormPost(sURL, sPara) {
    var allwinform = new FormSTD.form({
        url: sURL,
        method: 'post',
        params: sPara
    })
    $(allwinform).submit();

    allwinform = null;
}

function dataTableSortForChinese() {
    // oSort是排序类型数组, 'chinese-asc'是自己定义的类型的排序(*-asc || *-desc)名称
    // 插件应该会根据表格中的内容的类型(string, number, chinese)进行比较排序，
    // 如果以chinese类型来排序则用oSort['chinese-asc']和oSort['chinese-desc']的方法
    // oSort对应的function里面自定义比较方法
    jQuery.fn.dataTableExt.oSort['chinese-asc'] = function(x, y) {
        //javascript自带的中文比较函数，具体用法可自行查阅了解
        return x.localeCompare(y);
    };

    jQuery.fn.dataTableExt.oSort['chinese-desc'] = function(x, y) {
        return y.localeCompare(x);
    };

    // aTypes是插件存放表格内容类型的数组
    // reg赋值的正则表达式，用来判断是否是中文字符
    // 返回值push到aTypes数组，排序时扫描该数组，'chinese'则调用上面两个方法。返回null默认是'string'
    jQuery.fn.dataTableExt.aTypes.push(function(sData) {
        var reg = /^[\u4e00-\u9fa5]{0,}$/;
        if(reg.test(sData)) {
            return 'chinese';
        }
        return null;
    });
}

// 对Date的扩展，将 Date 转化为指定格式的String   
// 月(m)、日(d)、时(h)、分(n)、秒(s)、季度(q) 可以用 1-2 个占位符，   
// 年(y)可以用 1-4 个占位符，毫秒(w)只能用 1 个占位符(是 1-3 位的数字)   
// 例子：   
// (new Date()).Format("yyyy-mm-dd hh:nn:ss.w") ==> 2006-07-02 08:09:04.423   
// (new Date()).Format("yyyy-m-d h:n:s.w")      ==> 2006-7-2 8:9:4.18   
Date.prototype.format = function(format) {
    var o = {
        "m+": this.getMonth() + 1, //月份
        "d+": this.getDate(), //日期
        "h+": this.getHours(), //小时
        "n+": this.getMinutes(), //分钟
        "s+": this.getSeconds(), //秒
        "q+": Math.floor((this.getMonth() + 3) / 3), //季度
        "w": this.getMilliseconds() //毫秒
    }

    if(/(y+)/.test(format)) //月份
    {
        format = format.replace(RegExp.$1, (this.getFullYear() + "")
            .substr(4 - RegExp.$1.length));
    }

    for(var k in o) {
        if(new RegExp("(" + k + ")").test(format)) {
            format = format.replace(RegExp.$1, RegExp.$1.length ===
                1 ? o[k] : ("00" + o[k]).substr(("" + o[k]).length));
        }
    }
    return format;
}

function get_format_cur_time() {
    var formatdatatime = new Date().format("yyyy-mm-dd-hh-nn-ss");
    return formatdatatime;
}

function getCurrentUserID() {
    return $('#current_user_id').html();
}

function getCurrentUserName() {
    return $('#current_user_en_name').html();
}

function is_contain_quote(str) {
    if(str.indexOf("\'") >= 0 || str.indexOf("\"") >= 0 || str.indexOf(";") >= 0 || str.indexOf("\\") >=0 || str.indexOf("\/") >=0)
        return true;
}

function getUrlParam(name) {
    var reg = new RegExp("(^|&)" + name + "=([^&]*)(&|$)"); //构造一个含有目标参数的正则表达式对象
    var r = window.location.search.substr(1).match(reg); //匹配目标参数
    if(r != null) return unescape(r[2]);
    return null; //返回参数值
}

jQuery(document).ready(function() {
    if(!jQuery().dataTable) {
        return;
    }

    dataTableSortForChinese();
});

/* 
 *  方法:Array.remove(dx) 通过遍历,重构数组 
 *  功能:删除数组元素. 
 *  参数:dx删除元素的下标. 
 */
Array.prototype.remove = function(dx) {

    if(isNaN(dx) || dx > this.length) {
        return false;
    }

    for(var i = 0, n = 0; i < this.length; i++) {
        if(this[i] != this[dx]) {
            this[n++] = this[i]
        }
    }
    if (this.length>0) {
        this.length -= 1
    }   
}