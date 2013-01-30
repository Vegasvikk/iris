
$(document).ready(
    function () {

        iris.baseUri(iris.baseUri() + "examples/todo-list/app/");
        
        iris.locale(
            "en_US", {
                dayNames: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
                monthNames: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
                dateFormat: "m/d/Y h:i:s",
                currency: {
                    formatPos: "n",
                    formatNeg: "(n)",
                    decimal: ".",
                    thousand: ",",
                    precision: 2
                }
            }
        );

        iris.path = {
            welcome : "screen/welcome.js",
            welcome_tmpl : "screen/welcome.html",
            todo_item : "ui/todo_item.js",
            todo_item_tmpl : "ui/todo_item.html"
        };
        
        iris.welcome(iris.path.welcome);
    }
);
