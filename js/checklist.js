/*\
title: $:/plugins/tgrosinger/tw5-checklist/checklist.js
type: application/javascript
module-type: widget
\*/

(function(){

/*jslint node: true, browser: true */
/*global $tw: false */
"use strict";

var Widget = require("$:/core/modules/widgets/widget.js").widget;

var CheckListWidget = function(parseTreeNode,options) {
    this.initialise(parseTreeNode,options);
};

/*
Inherit from the base widget class
*/
CheckListWidget.prototype = new Widget();

/*
Render this widget into the DOM
*/
CheckListWidget.prototype.render = function(parent,nextSibling) {
    this.tiddlerTitle = this.getVariable("currentTiddler");
    this.startPos = parseInt(this.parseTreeNode.attributes.listStartPos.value);
    this.stopPos = parseInt(this.parseTreeNode.attributes.listStopPos.value);

    this.parentDomNode = parent;
    this.nextSibling = nextSibling;
    this.computeAttributes();
    this.execute();
};

/*
Retrieve the configuration state indicating if items should be re-arranged
*/
CheckListWidget.prototype.shouldMoveChecked = function() {
    var configWidgetTitle = "$:/plugins/tgrosinger/tw5-checklist/Configuration";
    var configWidgetFields = $tw.wiki.getTiddler(configWidgetTitle).fields;

    var moveChecked = configWidgetFields["move-checked"] || "true";
    return (moveChecked === "true");
}

/*
Retrieve the configuration state indicating if items should be re-sorted
*/
CheckListWidget.prototype.shouldSort= function() {
    var configWidgetTitle = "$:/plugins/tgrosinger/tw5-checklist/Configuration";
    var configWidgetFields = $tw.wiki.getTiddler(configWidgetTitle).fields;

    var sort = configWidgetFields["sort-alphabetically"] || "true";
    return (sort === "true");
}



/*
Compute the internal state of the widget
*/
CheckListWidget.prototype.execute = function() {
    var domNode = this.document.createElement("ul");
    domNode.className = "checklist";

    this.makeChildWidgets();
    this.renderChildren(domNode);

    /* add event listeners */
    $tw.utils.each(domNode.childNodes, function(childNode) {
        if (childNode.childNodes[0].className === "checklist-clearall") {
            // ClearAllChecks, do not use checkbox listener
            $tw.utils.addEventListeners(childNode.childNodes[0],
                    [{name: "click", handlerObject: this,
                        handlerMethod: "handleClearChecksEvent"}]);
        } else if (childNode.childNodes[1].className === "checklist-newitem") {
            // NewListItem, do not use checkbox listener
            $tw.utils.addEventListeners(childNode.childNodes[1], [
                    {name: "blur", handlerObject: this, handlerMethod: "handleBlurNewItemEvent"},
                    {name: "keyup", handlerObject: this, handlerMethod: "handleBlurNewItemEvent"}
            ]);
    // If this is a normal checklist item …
        } else {
            if (childNode.childNodes[0].checked) {
                $tw.utils.addEventListeners(childNode,
                        [{name: "change", handlerObject: this, handlerMethod: "handleUncheckEvent"}]);
            } else {
                $tw.utils.addEventListeners(childNode,
                        [{name: "change", handlerObject: this, handlerMethod: "handleCheckEvent"}]);
            }
            $tw.utils.addEventListeners(childNode.childNodes[1], [
                {name: "click", handlerObject: this, handlerMethod: "handleRemoveEvent"}
            ]);
        }
    }.bind(this));

    this.parentDomNode.insertBefore(domNode, this.nextSibling);
};

// When the user clicks the clear-all button, remove all checks
CheckListWidget.prototype.handleClearChecksEvent = function(event) {
    var domItem = event.target.parentNode;
    var domList = domItem.parentNode;

    var tiddlerBody = $tw.wiki.getTiddler(this.tiddlerTitle).fields.text;
    var bodyList = tiddlerBody.substring(this.startPos, this.stopPos).split("\n");
    var bodyLen = bodyList.length;

    for (var i = 0; i < bodyLen; i++) {
        bodyList[i] = bodyList[i].replace("[x]", "[ ]");
        bodyList[i] = bodyList[i].replace("[X]", "[ ]");
    }

    // Save the updated body
    var newBody = tiddlerBody.substring(0, this.startPos) +
                    bodyList.join("\n") +
                    tiddlerBody.substring(this.stopPos);
    $tw.wiki.setText(this.tiddlerTitle, "text", null, newBody);
};

CheckListWidget.prototype.reorderList = function(event, bodyList) {
    var domItem = event.target.parentNode;
    var domList = domItem.parentNode;
    
    var tiddlerBody = $tw.wiki.getTiddler(this.tiddlerTitle).fields.text;

    // Rearrange items (if configured to do so)
    var shouldMove = this.shouldMoveChecked();

    // Sort items  (if configured to do so)
    var shouldSort = this.shouldSort();

    // 分离注释行和活动行
    var activeItems = [];
    var commentedItems = [];
    for (var i = 0; i < bodyList.length; i++) {
        // 检查是否为注释行，使用 trim() 去除首尾空格
        if (bodyList[i].trim().startsWith("<!--") && bodyList[i].trim().endsWith("-->")) { 
            commentedItems.push(bodyList[i]);
        } else {
            activeItems.push(bodyList[i]);
        }
    }

    // 对未注释的行进行排序或重新排列
    if (shouldMove) {
        if (shouldSort) {
            activeItems.sort(function (a, b) { return a.toLowerCase().localeCompare(b.toLowerCase()); });
        } else {
            // 移除注释标记后再排序
            activeItems.sort(function (a, b) { return a.replace(/<!--.*?-->/g, "").trim().toLowerCase().localeCompare(b.replace(/<!--.*?-->/g, "").trim().toLowerCase()); });
        }
    } else if (shouldSort) {
        activeItems.sort(function (a, b) { return a.replace(/<!--.*?-->/g, "").trim().toLowerCase().localeCompare(b.replace(/<!--.*?-->/g, "").trim().toLowerCase()); });
    }

    // 将排序/重新排列后的 activeItems 和注释行合并
    bodyList = activeItems.concat(commentedItems);
    
    // Save the updated body
    var newBody = tiddlerBody.substring(0, this.startPos) +
                    bodyList.join("\n") +
                    tiddlerBody.substring(this.stopPos);
    $tw.wiki.setText(this.tiddlerTitle, "text", null, newBody);

}

// On blur or enter, save the new list item
CheckListWidget.prototype.handleBlurNewItemEvent = function(event) {
    if (event.type == "keyup" && event.keyCode != 13) {
        // This function receives both blur and keyup events.
        // Only run on blur or enter key
        return;
    }

    if (event.target.value.trim() === "") {
        // Don't save an empty list item
        return;
    }

    var checklist = event.target.parentNode.parentNode;
    var firstItem = checklist.childNodes[1];
    var pos = firstItem.childNodes[0].attributes.pos.nodeValue;

    var newItem = "[ ] " + event.target.value.trim() + "\n";
    event.target.value = "";

    var tiddlerBody = $tw.wiki.getTiddler(this.tiddlerTitle).fields.text;
    tiddlerBody = tiddlerBody.substring(0, pos) + newItem + tiddlerBody.substring(pos);
    var bodyList = tiddlerBody.substring(this.startPos, this.stopPos + newItem.length).split("\n");
    this.reorderList(event, bodyList) 
};



CheckListWidget.prototype.handleChecksEvents = function(event, oldCheckState, newCheckState) {
    var domItem = event.target.parentNode;
    var domList = domItem.parentNode;
    var itemIndex = [].indexOf.call(domList.childNodes, domItem) - 1;
    
    var tiddlerBody = $tw.wiki.getTiddler(this.tiddlerTitle).fields.text;
    var bodyList = tiddlerBody.substring(this.startPos, this.stopPos).split("\n");

    // Update the tiddler data
    bodyList[itemIndex] = bodyList[itemIndex].replace(oldCheckState, newCheckState);
    this.reorderList(event, bodyList) 

}

CheckListWidget.prototype.handleCheckEvent = function(event) {
    this.handleChecksEvents(event, "[ ]", "[x]");
};

CheckListWidget.prototype.handleUncheckEvent = function(event) {
    this.handleChecksEvents(event, "[x]", "[ ]");
};

CheckListWidget.prototype.handleRemoveEvent = function (event) {
    var domItem = event.target.parentNode;
    var domList = domItem.parentNode;
    var itemIndex = [].indexOf.call(domList.childNodes, domItem) - 1;

    var tiddlerBody = $tw.wiki.getTiddler(this.tiddlerTitle).fields.text;
    var bodyList = tiddlerBody.substring(this.startPos, this.stopPos).split("\n");

    // Update the tiddler data
    bodyList[itemIndex] = `<!-- ${bodyList[itemIndex]} -->`;
    var newBody = tiddlerBody.substring(0, this.startPos) +
                    bodyList.join("\n") +
                    tiddlerBody.substring(this.stopPos);
    $tw.wiki.setText(this.tiddlerTitle, "text", null, newBody);
};

/*
Selectively refreshes the widget if needed.
Returns true if the widget or any of its children needed re-rendering
*/
CheckListWidget.prototype.refresh = function(changedTiddlers) {
    var changedAttributes = this.computeAttributes();
    // Refresh if an attribute has changed, or the type associated with
    // the target tiddler has changed
    if(changedAttributes.tiddler || changedAttributes.field || changedAttributes.index ||
            (changedTiddlers[this.editTitle] && this.getEditorType() !== this.editorType)) {
        this.refreshSelf();
        return true;
    } else {
        return this.refreshChildren(changedTiddlers);
    }
};

exports.checklist = CheckListWidget;

})();