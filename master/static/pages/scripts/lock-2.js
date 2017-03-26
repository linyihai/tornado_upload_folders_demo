var Lock = function () {

    return {
        //main function to initiate the module
        init: function () {

             $.backstretch([
		        "../static/pages/media/bg/1.jpg",
    		    "../static/pages/media/bg/2.jpg",
    		    "../static/pages/media/bg/3.jpg",
    		    "../static/pages/media/bg/4.jpg"
		        ], {
		          fade: 1000,
		          duration: 8000
		      });
        }

    };

}();

jQuery(document).ready(function() {
    Lock.init();
});