/*
*     (C) Copyright 2008 Telefonica Investigacion y Desarrollo
*     S.A.Unipersonal (Telefonica I+D)
*
*     This file is part of Morfeo EzWeb Platform.
*
*     Morfeo EzWeb Platform is free software: you can redistribute it and/or modify
*     it under the terms of the GNU Affero General Public License as published by
*     the Free Software Foundation, either version 3 of the License, or
*     (at your option) any later version.
*
*     Morfeo EzWeb Platform is distributed in the hope that it will be useful,
*     but WITHOUT ANY WARRANTY; without even the implied warranty of
*     MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
*     GNU Affero General Public License for more details.
*
*     You should have received a copy of the GNU Affero General Public License
*     along with Morfeo EzWeb Platform.  If not, see <http://www.gnu.org/licenses/>.
*
*     Info about members and contributors of the MORFEO project
*     is available at
*
*     http://morfeo-project.org
 */

/*global document, window, Error, gettext, interpolate, $, Hash, Element, Event, isElement*/
/*global BrowserUtilsFactory, Constants, ColumnLayout, DragboardPosition, FreeLayout, FullDragboardLayout, Gadget, IGadget, LayoutManagerFactory, LogManagerFactory, OpManagerFactory, Wirecloud, ShowcaseFactory, SmartColumnLayout, URIs*/

/**
 * @author aarranz
 */
function Dragboard(tab, workSpace, dragboardElement) {
    // *********************************
    // PRIVATE VARIABLES
    // *********************************
    this.loaded = false;
    this.currentCode = 1;
    this.scrollbarSpace = 17; // TODO make this configurable?
    // TODO or initialized with the scroll bar's real with?
    this.dragboardElement = null;
    this.dragboardWidth = 800;
    this.dragboardHeight = 600;
    this.baseLayout = null;
    this.freeLayout = null;
    this.gadgetToMove = null;
    this.iGadgets = new Hash();
    this.iGadgetsByCode = new Hash();
    this.tab = tab;
    this.tabId = tab.tabInfo.id;
    this.workSpace = workSpace;
    this.workSpaceId = workSpace.workSpaceState.id;
    this.readOnly = false;

    // ***********************
    // PRIVATE FUNCTIONS
    // ***********************
    Dragboard.prototype.paint = function () {
        var oldLength, i;

        this.dragboardElement.innerHTML = "";

        this._recomputeSize();

        this.baseLayout.initialize();
        this.freeLayout.initialize();
        this.fulldragboardLayout.initialize();

        // Check if we have to readjust the z positions
        oldLength = this.orderList.length;
        this.orderList = this.orderList.compact();
        if (oldLength !== this.orderList.length) {
            for (i = 0; i < this.orderList.length; i += 1) {
                this.orderList[i].setZPosition(i);
            }
        }

        this.tab.mark_as_painted();
    };

    /**
     * Update igadget status in persistence
     */
    this._commitChanges = function (keys) {
        var onSuccess, onError;
        keys = keys || this.iGadgetsByCode.keys();

        onSuccess = function (transport) { };

        onError = function (transport, e) {
            var logManager = LogManagerFactory.getInstance();
            var msg = logManager.formatError(gettext("Error committing dragboard changes to persistence: %(errorMsg)s."), transport, e);
            logManager.log(msg);
        };

        // TODO only send real changes
        var iGadget, iGadgetInfo, uri, position, data, icon_position;
        data = [];

        for (var i = 0; i < keys.length; i++) {
            iGadget = this.iGadgetsByCode.get(keys[i]);
            iGadgetInfo = {};
            position = iGadget.getPosition();
            iGadgetInfo.id = iGadget.id;
            iGadgetInfo.tab = this.tabId;
            if (this.workSpace.isOwned()) {
                iGadgetInfo.minimized = iGadget.isMinimized();
            }
            if (!iGadget.isInFullDragboardMode()) {
                iGadgetInfo.top = iGadget.position.y;
                iGadgetInfo.left = iGadget.position.x;
                iGadgetInfo.zIndex = iGadget.zPos;
                iGadgetInfo.width = iGadget.contentWidth;
                iGadgetInfo.height = iGadget.height;
                iGadgetInfo.fulldragboard = false;
            } else {
                iGadgetInfo.fulldragboard = true;
            }

            iGadgetInfo.layout = iGadget.onFreeLayout() ? 1 : 0;

            icon_position = iGadget.getIconPosition();
            iGadgetInfo.icon_top = icon_position.y;
            iGadgetInfo.icon_left = icon_position.x;

            data.push(iGadgetInfo);
        }

        uri = URIs.GET_IGADGETS.evaluate({workspaceId: this.workSpaceId, tabId: this.tabId});
        Wirecloud.io.makeRequest(uri, {
            method: 'PUT',
            contentType: 'application/json',
            postBody: Object.toJSON(data),
            parameters: data,
            onSuccess: onSuccess,
            onFailure: onError
        });
    };

    /**
     *
     */
    Dragboard.prototype._buildLayoutFromPreferences = function (description) {
        var columns = this.tab.preferences.get('columns');
        var cell_height = this.tab.preferences.get('cell-height');
        var vertical_margin = this.tab.preferences.get('vertical-margin');
        var horizontal_margin = this.tab.preferences.get('horizontal-margin');

        if (this.tab.preferences.get('smart')) {
            return new SmartColumnLayout(this, columns, cell_height, vertical_margin, horizontal_margin);
        } else {
            return new ColumnLayout(this, columns, cell_height, vertical_margin, horizontal_margin);
        }
    };

    /**
     *
     */
    Dragboard.prototype._updateBaseLayout = function () {
        // Create the new Layout
        var newBaseLayout = this._buildLayoutFromPreferences();
        newBaseLayout.initialize();

        // Change our base layout
        this.baseLayout.moveTo(newBaseLayout);
        this.baseLayout.destroy();
        this.baseLayout = newBaseLayout;
    };

    // ****************
    // PUBLIC METHODS
    // ****************

    /**
     * Gets the width of the usable dragboard area.
     *
     * @returns The width of the usable dragboard area
     */
    Dragboard.prototype.getWidth = function () {
        return this.dragboardWidth;
    };

    /**
     * Gets the height of the usable dragboard area.
     *
     * @returns The height of the usable dragboard area
     */
    Dragboard.prototype.getHeight = function () {
        return this.dragboardHeight;
    };

    /**
     * This method must be called to avoid memory leaks caused by circular references.
     */
    Dragboard.prototype.destroy = function () {
        this.baseLayout.destroy();
        this.freeLayout.destroy();
        this.baseLayout = null;
        this.freeLayout = null;

        var keys = this.iGadgets.keys();
        //disconect and delete the connectables and variables of all tab iGadgets
        for (var i = 0; i < keys.length; i++) {
            this.workSpace.removeIGadgetData(keys[i]);
        }

        this.iGadgets = null;
        this.iGadgetsByCode = null;
        this.dragboardElement = null;
    };

    Dragboard.prototype.parseTab = function (tabInfo) {
        var curIGadget, position, icon_position, zPos, width, height, igadget,
            gadget, gadgetid, minimized, layout, menu_color, refusedVersion,
            opManager, i, readOnly;

        opManager = OpManagerFactory.getInstance();

        this.currentCode = 1;
        this.iGadgets = new Hash();
        this.iGadgetsByCode = new Hash();

        if (this.tab.readOnly || !this.workSpace.isOwned()) {
            this.readOnly = true;
            this.dragboardElement.addClassName("fixed");
        }

        // For controlling when the igadgets are totally loaded!
        for (i = 0; i < tabInfo.igadgetList.length; i++) {
            curIGadget = tabInfo.igadgetList[i];

            // Parse gadget id
            gadgetid = curIGadget.gadget.split("/");
            gadgetid = gadgetid[2] + "_" + gadgetid[3] + "_" + gadgetid[4];
            // Get gadget model
            gadget = ShowcaseFactory.getInstance().getGadget(gadgetid);

            // Parse width, height and the position of the igadget
            width = parseInt(curIGadget.width, 10);
            height = parseInt(curIGadget.height, 10);
            position = new DragboardPosition(parseInt(curIGadget.left, 10), parseInt(curIGadget.top, 10));
            icon_position = new DragboardPosition(parseInt(curIGadget.icon_left, 10), parseInt(curIGadget.icon_top, 10));
            zPos = parseInt(curIGadget.zIndex, 10);
            readOnly = curIGadget.readOnly;

            // Parse layout field
            if (curIGadget.layout === 0) {
                layout = this.baseLayout;
            } else {
                layout = this.freeLayout;
            }

            // Create instance model
            igadget = new IGadget(gadget,
                                  curIGadget.id,
                                  curIGadget.name,
                                  layout,
                                  position,
                                  icon_position,
                                  zPos,
                                  width,
                                  height,
                                  curIGadget.fulldragboard,
                                  curIGadget.minimized,
                                  curIGadget.transparency,
                                  curIGadget.menu_color,
                                  curIGadget.refused_version,
                                  false,
                                  readOnly);
        }

        this.loaded = true;
    };

    /**
     * Creates a new instance of the given gadget and inserts it into this
     * dragboard.
     *
     * @param gadget the gadget to use for creating the instance
     */
    Dragboard.prototype.addInstance = function (gadget, options_) {
        var options = {
            "igadgetName": gadget.getDisplayName() + ' (' + this.currentCode + ')',
            "setDefaultValues" : function () {}
        };

        Object.extend(options, options_);

        if (!(gadget instanceof Gadget)) {
            throw new TypeError();
        }

        if (this.readOnly) {
            var msg = gettext("The destination tab (%(tabName)s) is read only.");
            msg = interpolate(msg, {tabName: this.tab.tabInfo.name}, true);
            LayoutManagerFactory.getInstance().showMessageMenu(msg, Constants.Logging.WARN_MSG);
            return;
        }

        var template = gadget.getTemplate();
        //var width = layout.unitConvert(template.getWidth() + "cm", CSSPrimitiveValue.CSS_PX)[0];
        //width = layout.adaptWidth(width, width).inLU;
        var width = template.getWidth();
        var height = template.getHeight();
        var minimized = false;
        var freeLayoutAfterLoading = false;
        var layout = this.baseLayout;

        if (this.tab.preferences.get('layout') === "Free") {
            minimized = false; //NOTE: this variable is useless, it could be used in the future to add gadgets as icons directly
            freeLayoutAfterLoading = true; //To change the layout to FreeLayout after loading the gadget
        }

        // Check if the gadget doesn't fit in the dragboard
        if (layout instanceof ColumnLayout) {
            var maxColumns = layout.getColumns();
            if (width > maxColumns) {
                // TODO warning
                width = maxColumns;
            }
        }

        // Create the instance
        var iGadget = new IGadget(gadget, null, options.igadgetName, layout, null, null, null, width, height, false, minimized, false, gadget.getMenuColor(), null, freeLayoutAfterLoading, false);

        iGadget.save(options);
    };

    Dragboard.prototype.getNumberOfIGadgets = function () {
        return this.iGadgets.keys().length;
    };

    Dragboard.prototype.removeInstance = function (iGadgetId, orderFromServer) {
        var igadget = this.iGadgets.get(iGadgetId);

        igadget.remove(orderFromServer);
        igadget.destroy();
    };

    Dragboard.prototype.saveConfig = function (iGadgetId) {
        var igadget = this.iGadgets.get(iGadgetId);
        try {
            igadget.saveConfig();

            igadget.setConfigurationVisible(false);
        } catch (e) {
        }
    };

    Dragboard.prototype.setDefaultPrefs = function (iGadgetId) {
        var igadget = this.iGadgets.get(iGadgetId);
        igadget.setDefaultPrefs();
    };

    Dragboard.prototype.notifyErrorOnIGadget = function (iGadgetId) {
        var igadget = this.iGadgets.get(iGadgetId);
        igadget.notifyError();
    };

    Dragboard.prototype.getIGadgets = function () {
        return this.iGadgets.values();
    };

    Dragboard.prototype.getIGadget = function (iGadgetId) {
        return this.iGadgets.get(iGadgetId);
    };

    Dragboard.prototype.hasReadOnlyIGadgets = function () {
        var igadgetKeys = this.iGadgets.keys();
        for (var i = 0; i < igadgetKeys.length; i++) {
            if (this.iGadgets.get(igadgetKeys[i]).readOnly) {
                return true;
            }
        }
        return false;
    };

    Dragboard.prototype.getWorkspace = function () {
        return this.workSpace;
    };

    /**
     * Registers an iGadget into this dragboard.
     *
     * @private
     * @param iGadget the iGadget to register
     */
    Dragboard.prototype._registerIGadget = function (iGadget) {
        if (iGadget.id) {
            this.iGadgets.set(iGadget.id, iGadget);
        }

        iGadget.code = this.currentCode++;

        this.iGadgetsByCode.set(iGadget.code, iGadget);
        var zpos = iGadget.getZPosition();
        if (zpos !== null) {
            if (this.orderList[zpos] !== undefined) {
                this.orderList.splice(zpos, 1, this.orderList[zpos], iGadget);

                // Update following iGadgets
                for (var i = zpos + 1; i < this.orderList.length; i++) {
                    if (this.orderList[i] !== undefined) {
                        this.orderList[i].setZPosition(i);
                    }
                }
            } else {
                this.orderList[zpos] = iGadget;
            }
        } else {
            zpos = this.orderList.length;
            iGadget.setZPosition(zpos);
            this.orderList[zpos] = iGadget;
        }
    };

    /**
     * Deregisters an iGadget from this dragboard.
     *
     * @private
     * @param iGadget the iGadget to register
     */
    Dragboard.prototype._deregisterIGadget = function (iGadget) {
        this.iGadgets.unset(iGadget.id);
        this.iGadgetsByCode.unset(iGadget.code);

        // Update z order List
        var zpos = iGadget.getZPosition();
        this.orderList.splice(zpos, 1);
        iGadget.setZPosition(null);

        for (var i = zpos; i < this.orderList.length; i++) {
            this.orderList[i].setZPosition(i);
        }

        iGadget.code = null;
    };

    Dragboard.prototype.addIGadget = function (iGadget, igadgetInfo, options) {
        if (!this.iGadgetsByCode.get(iGadget.code)) {
            throw new Error();
        }

        this.iGadgets.set(iGadget.id, iGadget);

        var oldHeight = iGadget.getHeight();
        var oldWidth = iGadget.getWidth();

        this.workSpace.addIGadget(this.tab, iGadget, igadgetInfo, options);

        // Notify resize event
        iGadget.layout._notifyResizeEvent(iGadget, oldWidth, oldHeight, iGadget.getWidth(), iGadget.getHeight(), false, true);
    };

    Dragboard.prototype.fillFloatingGadgetsMenu = function (menu) {
        this.freeLayout.fillFloatingGadgetsMenu(menu);
    };

    Dragboard.prototype.lowerToBottom = function (iGadget) {
        var zPos = iGadget.getZPosition();
        delete this.orderList[zPos];
        this.orderList = [iGadget].concat(this.orderList).compact();

        for (var i = 0; i < this.orderList.length; i++) {
            this.orderList[i].setZPosition(i);
        }

        this._commitChanges();
    };

    Dragboard.prototype.lower = function (iGadget) {
        var zPos = iGadget.getZPosition();
        if (zPos === 0) {
            // Nothing to do if we are already in the bottom
            return;
        }

        var prevIGadget = this.orderList[zPos - 1];
        this.orderList[zPos - 1] = iGadget;
        this.orderList[zPos] = prevIGadget;

        iGadget.setZPosition(zPos - 1);
        prevIGadget.setZPosition(zPos);

        this._commitChanges([iGadget.code, prevIGadget.code]);
    };

    Dragboard.prototype.raiseToTop = function (iGadget) {
        var oldZPos = iGadget.getZPosition();
        var newZPos = this.orderList.length - 1;

        if (oldZPos === newZPos) {
            return; // Nothing to do
        }

        delete this.orderList[oldZPos];
        this.orderList.push(iGadget);
        this.orderList = this.orderList.compact();

        var i = 0;
        for (; i < this.orderList.length; i++) {
            this.orderList[i].setZPosition(i);
        }

        this._commitChanges();
    };

    Dragboard.prototype.raise = function (iGadget) {
        var zPos = iGadget.getZPosition();
        if (zPos === (this.orderList.length - 1)) {
            // Nothing to do if we are already in the top
            return;
        }

        var nextIGadget = this.orderList[zPos + 1];
        this.orderList[zPos + 1] = iGadget;
        this.orderList[zPos] = nextIGadget;

        iGadget.setZPosition(zPos + 1);
        nextIGadget.setZPosition(zPos);

        this._commitChanges([iGadget.code, nextIGadget.code]);
    };

    // *******************
    // INITIALIZING CODE
    // *******************
    this.dragboardElement = dragboardElement;
    this.orderList = [];

    // Window Resize event dispacher function
    this._notifyWindowResizeEvent = function () {
        var oldWidth = this.dragboardWidth;
        var oldHeight = this.dragboardHeight;
        this._recomputeSize();
        var newWidth = this.dragboardWidth;
        var newHeight = this.dragboardHeight;

        var widthChanged = oldWidth !== newWidth;
        var heightChanged = oldHeight !== newHeight;
        if (widthChanged || heightChanged) {
            this._updateIGadgetSizes(widthChanged, heightChanged);
        }
    }.bind(this);

    this.baseLayout = this._buildLayoutFromPreferences();
    this.freeLayout = new FreeLayout(this);
    this.fulldragboardLayout = new FullDragboardLayout(this);

    this.parseTab(tab.tabInfo);
}

/**
 * @private
 *
 * This function is slow. Please, only call it when really necessary.
 *
 * Updates the width and height info for this dragboard.
 */
Dragboard.prototype._recomputeSize = function () {
    var cssStyle = document.defaultView.getComputedStyle(this.dragboardElement, null);
    if (cssStyle.getPropertyValue("display") === "none") {
        return; // Do nothing
    }

    if (BrowserUtilsFactory.getInstance().isIE()) {
        this.dragboardWidth = parseInt(this.dragboardElement.offsetWidth, 10);
    } else {
        this.dragboardWidth = parseInt(this.dragboardElement.clientWidth, 10);
    }

    /* Pre reserve scroll bar space */

    var dragboardElement = this.dragboardElement;

    this.topMargin = cssStyle.getPropertyCSSValue("padding-top").getFloatValue(CSSPrimitiveValue.CSS_PX);
    this.bottomMargin = cssStyle.getPropertyCSSValue("padding-bottom").getFloatValue(CSSPrimitiveValue.CSS_PX);
    this.leftMargin = cssStyle.getPropertyCSSValue("padding-left").getFloatValue(CSSPrimitiveValue.CSS_PX);
    this.rightMargin = cssStyle.getPropertyCSSValue("padding-right").getFloatValue(CSSPrimitiveValue.CSS_PX);

    this.dragboardWidth = parseInt(dragboardElement.offsetWidth, 10);
    this.dragboardWidth -= this.leftMargin + this.rightMargin;

    var tmp = this.dragboardWidth;
    tmp -= parseInt(dragboardElement.clientWidth, 10);

    if (tmp > this.scrollbarSpace)
        this.dragboardWidth -= tmp;
    else
        this.dragboardWidth -= this.scrollbarSpace;

    // TODO
    this.dragboardHeight = parseInt(dragboardElement.clientHeight, 10);
};

/**
 * @private
 *
 * This method forces recomputing of the iGadgets' sizes.
 *
 * @param {boolean} widthChanged
 * @param {boolean} heightChanged
 */
Dragboard.prototype._updateIGadgetSizes = function (widthChanged, heightChanged) {
    this.baseLayout._notifyWindowResizeEvent(widthChanged, heightChanged);
    this.freeLayout._notifyWindowResizeEvent(widthChanged, heightChanged);
    this.fulldragboardLayout._notifyWindowResizeEvent(widthChanged, heightChanged);
};


/////////////////////////////////////
// DragboardPosition
/////////////////////////////////////
function DragboardPosition(x, y) {
    this.x = x;
    this.y = y;
}

DragboardPosition.prototype.clone = function () {
    return new DragboardPosition(this.x, this.y);
};

/////////////////////////////////////
// DragboardCursor
/////////////////////////////////////

/**
 * @class This class represents a dragboard cursor. It is usually used in drag
 *        & drop operations and always represents the place where an iGadget is
 *        going to be placed.
 *
 * @author Álvaro Arranz
 *
 * @param iGadget iGadget that is going to be represented by the new dragboard
 *                cursor
 */
function DragboardCursor(iGadget) {
    this.refIGadget = iGadget;

    var positiontmp = iGadget.getPosition();
    this.position = positiontmp.clone();

    this.layout = iGadget.layout;
    this.width = iGadget.getWidth();
    this.height = iGadget.getHeight();
    this.heightInPixels = iGadget.element.offsetHeight;
    this.widthInPixels = iGadget.element.offsetWidth;
}

DragboardCursor.prototype.getWidth = function () {
    return this.width;
};

DragboardCursor.prototype.getHeight = function () {
    return this.height;
};

DragboardCursor.prototype.paint = function (dragboard) {
    var dragboardCursor = document.createElement("div");
    dragboardCursor.setAttribute("id", "dragboardcursor");

    // Set width and height
    dragboardCursor.style.height = this.heightInPixels + "px";
    dragboardCursor.style.width = this.widthInPixels + "px";

    // Set position
    dragboardCursor.style.left = (this.layout.getColumnOffset(this.position.x) - 2) + "px"; // TODO -2 px for borders
    dragboardCursor.style.top = (this.layout.getRowOffset(this.position.y) - 2) + "px"; // TODO -2 px for borders

    dragboardCursor.style.zIndex = this.refIGadget.getZPosition();

    // assign the created element
    dragboard.insertBefore(dragboardCursor, this.refIGadget.element);
    this.element = dragboardCursor;
};

/**
 * This method must be called to avoid memory leaks caused by circular
 * references.
 */
DragboardCursor.prototype.destroy = function () {
    if (isElement(this.element)) {
        this.element.parentNode.removeChild(this.element);
        this.element = null;
    }
};

DragboardCursor.prototype.getWidth = function () {
    return this.width;
};

DragboardCursor.prototype.getPosition = IGadget.prototype.getPosition;

DragboardCursor.prototype.setPosition = function (position) {
    this.position = position;

    if (this.element !== null) { // if visible
        this.element.style.left = (this.layout.getColumnOffset(position.x) - 2) + "px"; // TODO -2 px for borders
        this.element.style.top = (this.layout.getRowOffset(position.y) - 2) + "px"; // TODO -2 px for borders
    }
};

/////////////////////////////////////
// Drag and drop support
/////////////////////////////////////
var EzWebEffectBase = {};
EzWebEffectBase.findDragboardElement = function (element) {
    var tmp = element.parentNode;
    while (isElement(tmp)) {
        //var position = tmp.getStyle("position");
        var position = document.defaultView.getComputedStyle(tmp, null).getPropertyValue("position");
        switch (position) {
        case "relative":
        case "absolute":
        case "fixed":
            return tmp;
        }

        tmp = tmp.parentNode;
    }
    return null; // Not found
};

/**
 * @param draggableElement {HTMLElement} Element to drag
 * @param handler {HTMLElement} Element where the drag & drop operation must to be started
 * @param data {Object} context
 */
function Draggable(handler, data, onStart, onDrag, onFinish, canBeDragged, onScroll) {
    var xStart = 0, yStart = 0, xScrollStart = 0, yScrollStart = 0;
    var xScrollDelta, yScrollDelta;
    var dragboardCover;
    var draggable = this;
    var enddrag, drag, startdrag, scroll;
    canBeDragged = canBeDragged ? canBeDragged : Draggable._canBeDragged;

    // remove the events
    enddrag = function (e) {
        e = e || window.event; // needed for IE

        // Only attend to left button (or right button for left-handed persons) events
        if (!BrowserUtilsFactory.getInstance().isLeftButton(e.button)) {
            return;
        }

        Event.stopObserving(document, "mouseup", enddrag);
        Event.stopObserving(document, "mousemove", drag);

        if (dragboardCover != null) {
            dragboardCover.parentNode.removeEventListener("scroll", scroll, true);
            dragboardCover.parentNode.removeChild(dragboardCover);
            dragboardCover = null;
        }

        onFinish(draggable, data, e);

        handler.addEventListener("mousedown", startdrag, false);

        document.onmousedown = null; // reenable context menu
        document.onselectstart = null; // reenable text selection in IE
        document.oncontextmenu = null; // reenable text selection
    };

    // fire each time it's dragged
    drag = function (e) {
        e = e || window.event; // needed for IE

        var screenX = parseInt(e.screenX, 10);
        var screenY = parseInt(e.screenY, 10);
        var xDelta = screenX - xStart - xScrollDelta;
        var yDelta = screenY - yStart - yScrollDelta;

        onDrag(e, draggable, data, xDelta, yDelta);
    };

    // initiate the drag
    startdrag = function (e) {
        e = e || window.event; // needed for IE

        // Only attend to left button (or right button for left-handed persons) events
        if (!BrowserUtilsFactory.getInstance().isLeftButton(e.button)) {
            return false;
        }

        if (!canBeDragged(draggable, data)) {
            return false;
        }

        document.oncontextmenu = Draggable._cancel; // disable context menu
        document.onmousedown = Draggable._cancel; // disable text selection in Firefox
        document.onselectstart = Draggable._cancel; // disable text selection in IE
        handler.removeEventListener("mousedown", startdrag, false);

        xStart = parseInt(e.screenX, 10);
        yStart = parseInt(e.screenY, 10);

        Event.observe(document, "mouseup", enddrag);
        Event.observe(document, "mousemove", drag);

        yScrollDelta = 0;
        xScrollDelta = 0;

        options = onStart(draggable, data, e);
        // TODO
        if (options != null && options.dragboard) {
            var dragboard = options.dragboard;
            dragboardCover = document.createElement("div");
            Element.extend(dragboardCover);
            dragboardCover.addClassName("cover");
            dragboardCover.observe("mouseup", enddrag, true);
            dragboardCover.observe("mousemove", drag, true);

            dragboardCover.style.zIndex = "1000000";
            dragboardCover.style.position = "absolute";
            dragboardCover.style.top = "0";
            dragboardCover.style.left = "0";
            dragboardCover.style.width = "100%";
            dragboardCover.style.height = dragboard.scrollHeight + "px";

            yScrollStart = parseInt(dragboard.scrollTop, 10);
            xScrollStart = parseInt(dragboard.scrollLeft, 10);

            dragboardCover.addEventListener("scroll", scroll, true);

            dragboard.insertBefore(dragboardCover, dragboard.firstChild);
        }

        return false;
    };

    // fire each time the dragboard is scrolled while dragging
    scroll = function (e) {
        e = e || window.event; // needed for IE

        var dragboard = dragboardCover.parentNode;
        dragboardCover.style.height = dragboard.scrollHeight + "px";
        var scrollTop = parseInt(dragboard.scrollTop, 10);

        // yScrollDeltaDiff = diff between old scroll y delta and the new scroll y delta
        var oldYDelta = yScrollDelta;
        yScrollDelta = yScrollStart - scrollTop;
        var yScrollDeltaDiff = yScrollDelta - oldYDelta;

        var scrollLeft = parseInt(dragboard.scrollLeft, 10);
        // xScrollDeltaDiff = diff between old scroll x delta and the new scroll x delta
        var oldXDelta = xScrollDelta;
        xScrollDelta = xScrollStart - scrollLeft;
        var xScrollDeltaDiff = xScrollDelta - oldXDelta;

        onScroll(e, draggable, data, xScrollDeltaDiff, yScrollDeltaDiff);
    };

    // add mousedown event listener
    handler.addEventListener("mousedown", startdrag, false);

    /**********
     * Public methods
     **********/

    this.destroy = function () {
        handler.removeEventListener("mousedown", startdrag, false);
        startdrag = null;
        enddrag = null;
        drag = null;
        scroll = null;
        draggable = null;
        data = null;
        handler = null;
    };
}

Draggable._cancelbubbling = function (e) {
    e = e || window.event; // needed for IE
    Event.stop(e);
};

Draggable._canBeDragged = function () {
    return true;
};

Draggable._cancel = function () {
    return false;
};



/////////////////////////////////////
// IGadget drag & drop support
/////////////////////////////////////
function IGadgetDraggable(iGadget) {
    var context = {
        iGadget: iGadget
    };
    Draggable.call(this, iGadget.gadgetMenu, context,
                         IGadgetDraggable.prototype.startFunc,
                         IGadgetDraggable.prototype.updateFunc,
                         IGadgetDraggable.prototype.finishFunc,
                         IGadgetDraggable.prototype.canBeDraggedFunc);

    this.setXOffset = function (xOffset) {
        context.xOffset = xOffset;
    };

    this.setYOffset = function (yOffset) {
        context.yOffset = yOffset;
    };
}

IGadgetDraggable.prototype.canBeDraggedFunc = function (draggable, context) {
    return context.iGadget.isAllowed('move') && !(context.iGadget.layout instanceof FullDragboardLayout);
};


IGadgetDraggable.prototype.startFunc = function (draggable, context) {
    context.selectedTab = null;
    context.selectedTabElement = null;
    context.layout = context.iGadget.layout;
    context.dragboard = context.layout.dragboard;
    context.currentTab = context.dragboard.tabId;
    context.dragboard.raiseToTop(context.iGadget);
    context.layout.initializeMove(context.iGadget, draggable);

    context.y = context.iGadget.element.style.top === "" ? 0 : parseInt(context.iGadget.element.style.top, 10);
    context.x = context.iGadget.element.style.left === "" ? 0 : parseInt(context.iGadget.element.style.left, 10);

    return {
        dragboard: EzWebEffectBase.findDragboardElement(context.iGadget.element)
    };
};

IGadgetDraggable.prototype._findTabElement = function (curNode, maxRecursion) {
    if (maxRecursion === 0) {
        return null;
    }

    // Only check elements, skip other dom nodes.
    if (isElement(curNode) && Element.extend(curNode).hasClassName('tab')) {
        return curNode;
    } else {
        var parentNode = curNode.parentNode;
        if (isElement(parentNode)) {
            return this._findTabElement(parentNode, maxRecursion - 1);
        } else {
            return null;
        }
    }
};

IGadgetDraggable.prototype.updateFunc = function (event, draggable, context, xDelta, yDelta) {
    var x, y, element = null;

    context.iGadget.element.style.left = (context.x + xDelta) + 'px';
    context.iGadget.element.style.top = (context.y + yDelta) + 'px';

    x = context.x + xDelta + context.xOffset;
    y = context.y + yDelta + context.yOffset;

    // Check if the mouse is over a tab
    element = document.elementFromPoint(event.clientX, event.clientY);
    if (element !== null) {
        // elementFromPoint may return inner tab elements
        element = draggable._findTabElement(element, 4);
    }

    var id = null;
    if (element !== null) {
        id = element.getAttribute("id");

        if (id !== null) {
            var result = id.match(/tab_(\d+)_(\d+)/);
            if (result !== null && result[2] !== context.currentTab) {
                if (context.selectedTab === result[2]) {
                    return;
                }

                if (context.selectedTabElement !== null) {
                    context.selectedTabElement.removeClassName("selected");
                }

                context.selectedTab = result[2];
                context.selectedTabElement = element;
                context.selectedTabElement.addClassName("selected");
                context.layout.disableCursor();
                return;
            }
        }
    }

    // The mouse is not over a tab
    // The cursor must allways be inside the dragboard
    var position = context.layout.getCellAt(x, y);
    if (position.y < 0) {
        position.y = 0;
    }
    if (position.x < 0) {
        position.x = 0;
    }
    if (context.selectedTabElement !== null) {
        context.selectedTabElement.removeClassName("selected");
    }
    context.selectedTab = null;
    context.selectedTabElement = null;
    context.layout.moveTemporally(position.x, position.y);
    return;
};

IGadgetDraggable.prototype.finishFunc = function (draggable, context) {
    var tab, destDragboard, workspace, destLayout;
    if (context.selectedTab !== null) {
        context.layout.cancelMove();

        workspace = context.dragboard.workSpace;
        tab = workspace.getTab(context.selectedTab);

        // On-demand loading of tabs!
        if (!tab.is_painted()) {
            tab.paint();
        }
        destDragboard = tab.getDragboard();

        if (context.iGadget.onFreeLayout()) {
            destLayout = destDragboard.freeLayout;
        } else {
            destLayout = destDragboard.baseLayout;
        }

        context.iGadget.moveToLayout(destLayout);

        workspace.highlightTab(parseInt(context.selectedTab, 10));

        context.selectedTab = null;
        context.selectedTabElement = null;
    } else {
        context.layout.acceptMove();
    }

    context.dragboard = null;
};


/////////////////////////////////////
// IGadget Icon drag & drop support
/////////////////////////////////////
function IGadgetIconDraggable(iGadget) {
    var context = {
        iGadget: iGadget,
        x: null,
        y: null
    };
    Draggable.call(this, iGadget.iconImg, context,
                         IGadgetIconDraggable.prototype.startFunc,
                         IGadgetIconDraggable.prototype.updateFunc,
                         IGadgetIconDraggable.prototype.finishFunc,
                         IGadgetIconDraggable.prototype.canBeDraggedFunc);
}

IGadgetIconDraggable.prototype.canBeDraggedFunc = function (draggable, context) {
    return true;
};


IGadgetIconDraggable.prototype.startFunc = function (draggable, context) {
    context.x = null;
    context.y = null;
    context.oldZIndex = context.iGadget.getZPosition();
    context.iGadget.setZPosition("999999");
    context.dragboard = context.iGadget.layout.dragboard;

    return {
        dragboard: EzWebEffectBase.findDragboardElement(context.iGadget.element)
    };
};


IGadgetIconDraggable.prototype.updateFunc = function (event, draggable, context, x, y) {
    context.x = x;
    context.y = y;
    return;
};

IGadgetIconDraggable.prototype.finishFunc = function (draggable, context) {
    context.iGadget.setZPosition(context.oldZIndex);
    if (context.x) {
        var position = context.iGadget.layout.getCellAt(context.x, context.y);

        if (position.y < 0) {
            position.y = 0;
        }
        if (position.x < 0) {
            position.x = 0;
        }

        context.iGadget.setIconPosition(position);
        context.iGadget.layout.dragboard._commitChanges([context.iGadget.code]);
    } else {
        // It is here instead of in a click event due to the behaviour of the IE
        context.iGadget.setMinimizeStatus(false);
        context.iGadget.layout.dragboard.raiseToTop(context.iGadget);
    }

    // This is needed to check if the scrollbar status has changed (visible/hidden)
    context.dragboard._notifyWindowResizeEvent();
};



/////////////////////////////////////
// resize support
/////////////////////////////////////

function ResizeHandle(resizableElement, handleElement, data, onStart, onResize, onFinish, canBeResized) {
    var xDelta = 0, yDelta = 0;
    var xStart = 0, yStart = 0;
    var yScroll = 0;
    var dragboardCover;
    var x, y;
    var endresize, resize, startresize, scroll;
    canBeResized = canBeResized ? canBeResized : ResizeHandle._canBeResized;


    // remove the events
    endresize = function (e) {
        e = e || window.event; // needed for IE

        // Only attend to left button (or right button for left-handed persons) events
        if (!BrowserUtilsFactory.getInstance().isLeftButton(e.button)) {
            return false;
        }

        Event.stopObserving(document, "mouseup", endresize);
        Event.stopObserving(document, "mousemove", resize);

        dragboardCover.parentNode.stopObserving("scroll", scroll);
        dragboardCover.parentNode.removeChild(dragboardCover);
        dragboardCover = null;

        handleElement.stopObserving("mouseup", endresize, true);
        handleElement.stopObserving("mousemove", resize, true);

        onFinish(resizableElement, handleElement, data);

        // Restore start event listener
        handleElement.observe("mousedown", startresize);

        document.onmousedown = null; // reenable context menu
        document.onselectstart = null; // reenable text selection in IE
        document.oncontextmenu = null; // reenable text selection

        return false;
    };

    // fire each time the mouse is moved while resizing
    resize = function (e) {
        e = e || window.event; // needed for IE

        xDelta = xStart - parseInt(e.screenX, 10);
        yDelta = yStart - parseInt(e.screenY, 10);
        xStart = parseInt(e.screenX, 10);
        yStart = parseInt(e.screenY, 10);
        y = y - yDelta;
        x = x - xDelta;

        onResize(resizableElement, handleElement, data, x, y);
    };

    // fire each time the dragboard is scrolled while dragging
    scroll = function () {
        var dragboard = dragboardCover.parentNode;
        dragboardCover.style.height = dragboard.scrollHeight + "px";
        var scrollTop = parseInt(dragboard.scrollTop, 10);
        var scrollDelta = yScroll - scrollTop;
        y -= scrollDelta;
        yScroll = scrollTop;

        onResize(resizableElement, handleElement, data, x, y);
    };

    // initiate the resizing
    startresize = function (e) {
        e = e || window.event; // needed for IE

        if (!canBeResized(resizableElement, data)) {
            return false;
        }

        // Only attend to left button (or right button for left-handed persons) events
        if (!BrowserUtilsFactory.getInstance().isLeftButton(e.button)) {
            return false;
        }

        document.oncontextmenu = ResizeHandle._cancel; // disable context menu
        document.onmousedown = ResizeHandle._cancel; // disable text selection
        document.onselectstart = ResizeHandle._cancel; // disable text selection in IE
        handleElement.stopObserving("mousedown", startresize);

        xStart = parseInt(e.screenX, 10);
        yStart = parseInt(e.screenY, 10);
        x = resizableElement.offsetLeft + handleElement.offsetLeft + (handleElement.offsetWidth / 2);
        y = resizableElement.offsetTop + handleElement.offsetTop + (handleElement.offsetHeight / 2);
        Event.observe(document, "mouseup", endresize);
        Event.observe(document, "mousemove", resize);

        var dragboard = EzWebEffectBase.findDragboardElement(resizableElement);
        dragboardCover = document.createElement("div");
        Element.extend(dragboardCover);
        dragboardCover.addClassName("cover");
        dragboardCover.observe("mouseup", endresize, true);
        dragboardCover.observe("mousemove", resize, true);

        dragboardCover.style.zIndex = "1000000";
        dragboardCover.style.position = "absolute";
        dragboardCover.style.top = "0";
        dragboardCover.style.left = "0";
        dragboardCover.style.width = "100%";
        dragboardCover.style.height = dragboard.scrollHeight + "px";

        yScroll = parseInt(dragboard.scrollTop, 10);

        dragboard.observe("scroll", scroll);

        dragboard.insertBefore(dragboardCover, dragboard.firstChild);

        handleElement.observe("mouseup", endresize, true);
        handleElement.observe("mousemove", resize, true);

        onStart(resizableElement, handleElement, data);

        return false;
    };

    // Add event listener
    Event.observe(handleElement, "mousedown", startresize);

    this.destroy = function () {
        Event.stopObserving(handleElement, "mousedown", startresize);
        startresize = null;
        resize = null;
        scroll = null;
        endresize = null;
        data = null;
        handleElement = null;
    };
}

ResizeHandle._canBeResized = function () {
    return true;
};

ResizeHandle._cancel = function () {
    return false;
};

/////////////////////////////////////
// IGadget resize support
/////////////////////////////////////
function IGadgetResizeHandle(handleElement, iGadget, resizeLeftSide) {
    ResizeHandle.call(this, iGadget.element, handleElement,
                            {iGadget: iGadget, resizeLeftSide: resizeLeftSide},
                            IGadgetResizeHandle.prototype.startFunc,
                            IGadgetResizeHandle.prototype.updateFunc,
                            IGadgetResizeHandle.prototype.finishFunc,
                            IGadgetResizeHandle.prototype.canBeResizedFunc);
}

IGadgetResizeHandle.prototype.canBeResizedFunc = function (resizableElement, data) {
    return data.iGadget.isAllowed('resize');
};

IGadgetResizeHandle.prototype.startFunc = function (resizableElement, handleElement, data) {
    handleElement.addClassName("inUse");
    // TODO merge with igadget minimum sizes
    data.minWidth = Math.ceil(data.iGadget.layout.fromPixelsToHCells(80));
    data.minHeight = Math.ceil(data.iGadget.layout.fromPixelsToVCells(50));
    data.innitialWidth = data.iGadget.getWidth();
    data.innitialHeight = data.iGadget.getHeight();
    data.iGadget.igadgetNameHTMLElement.blur();
    data.oldZIndex = data.iGadget.getZPosition();
    data.iGadget.setZPosition("999999");
    data.dragboard = data.iGadget.layout.dragboard;
};

IGadgetResizeHandle.prototype.updateFunc = function (resizableElement, handleElement, data, x, y) {
    var iGadget = data.iGadget;

    // Skip if the mouse is outside the dragboard
    if (iGadget.layout.isInside(x, y)) {
        var position = iGadget.layout.getCellAt(x, y);
        var currentPosition = iGadget.getPosition();
        var width;

        if (data.resizeLeftSide) {
            width = currentPosition.x + iGadget.getWidth() - position.x;
        } else {
            width = position.x - currentPosition.x + 1;
        }
        var height = position.y - currentPosition.y + 1;

        // Minimum width
        if (width < data.minWidth) {
            width = data.minWidth;
        }

        // Minimum height
        if (height < data.minHeight) {
            height = data.minHeight;
        }

        if (width !== iGadget.getWidth() || height !== iGadget.getHeight()) {
            iGadget.setSize(width, height, data.resizeLeftSide, false);
        }
    }
};

IGadgetResizeHandle.prototype.finishFunc = function (resizableElement, handleElement, data) {
    var iGadget = data.iGadget;
    data.iGadget.setZPosition(data.oldZIndex);
    if (data.innitialWidth !== data.iGadget.getWidth() || data.innitialHeight !== data.iGadget.getHeight()) {
        iGadget.setSize(iGadget.getWidth(), iGadget.getHeight(), data.resizeLeftSide, true);
    }
    handleElement.removeClassName("inUse");

    // This is needed to check if the scrollbar status has changed (visible/hidden)
    data.dragboard._notifyWindowResizeEvent();
};