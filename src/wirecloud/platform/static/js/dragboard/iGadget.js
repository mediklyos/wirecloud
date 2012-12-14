/*
*     (C) Copyright 2008 Telefonica Investigacion y Desarrollo
*     S.A.Unipersonal (Telefonica I+D)
*
*     (C) Copyright 2011-2012 Universidad Politécnica de Madrid
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

/*jslint white: true, onevar: false, undef: true, nomen: false, eqeqeq: true, plusplus: false, bitwise: true, regexp: true, newcap: true, immed: true, strict: false, forin: true, sub: true*/
/*global $, CSSPrimitiveValue, Element, Event, Insertion, document, gettext, ngettext, interpolate, window */
/*global Constants, DropDownMenu, LayoutManagerFactory, LogManagerFactory, OpManagerFactory, Wirecloud, ShowcaseFactory*/
/*global isElement, IWidgetLogManager, IWidgetResizeHandle, WidgetVersion, DragboardPosition, Concept*/
/*global IWidgetDraggable, IWidgetIconDraggable, FreeLayout, FullDragboardLayout*/
/*global ColorDropDownMenu, BrowserUtilsFactory, setTimeout, clearTimeout*/

/**
 * Creates an instance of a Widget.
 *
 * @author Álvaro Arranz
 *
 * @class Represents an instance of a Widget.
 *
 * @param {Widget}            widget        Widget of this iWidget
 * @param {Number}            iWidgetId     iWidget id in persistence. This
 *                                          parameter can be null for new
 *                                          iWidgets (not coming from
 *                                          persistence)
 * @param {String}            iWidgetName   current widget
 * @param {DragboardLayout}   layout        associated layout
 * @param {DragboardPosition} position      initial position. This parameter can
 *                                          be null for new iWidgets (not coming
 *                                          from persistence)
 * @param {Number}            zPos          initial z coordinate position. This
 *                                          parameter can be null for new
 *                                          iWidgets (not coming from
 *                                          persistence)
 * @param {Number}            width         initial content width
 * @param {Number}            height        initial content height
 * @param {Boolean}           fulldragboard initial fulldragboard mode
 * @param {Boolean}           minimized     initial minimized status
 * @param {Boolean}           transparency  initial transparency status
 * @param {String}            menu_color    background color for the menu.
 *                                          (6 chars with a hexadecimal color)
 */
function IWidget(widget, iWidgetId, iWidgetName, layout, position, iconPosition, zPos, width, height, fulldragboard, minimized, transparency, refusedVersion, freeLayoutAfterLoading, readOnly) {
    this.logManager = new IWidgetLogManager(this);
    this.id = iWidgetId;
    this.code = null;
    this.name = iWidgetName;
    this.widget = widget;
    this.position = position;
    this.contentWidth = Number(width);
    this.contentHeight = Number(height);
    this.loaded = false;
    this.zPos = zPos;
    this.transparency = transparency;
    this.draggable = null;
    this.visible = false;
    this.minimized = minimized;
    this.highlightTimeout = null;
    if (this.id) {
        this.codeURL = this.widget.code_url + "#id=" + this.id;
    }

    if (fulldragboard) {
        this.minimized = false;
        this.previousContentWidth = this.contentWidth;
        this.previousHeight = this.contentHeight + layout.getMenubarSize().inLU; // TODO
        this.previousLayout = layout;
        this.previousPosition = this.position.clone();
        this.height = 1;
        this.width = 1;
        this.position.x = 0;
        this.position.y = 0;

        layout = layout.dragboard.fulldragboardLayout;
    } else if (!minimized) {
        this.height = this.contentHeight;
    } else {
        this.height = layout.getMenubarSize().inLU;
    }

    this.refusedVersion = refusedVersion !== null ? new WidgetVersion(refusedVersion) : null;
    this.freeLayoutAfterLoading = freeLayoutAfterLoading; //only used the first time the widget is used to change its layout after loading to FreeLayout

    this.readOnly = readOnly;

    // Elements
    this.element = null;
    this.widgetMenu = null;
    this.contentWrapper = null;
    this.content = null;
    this.closeButton = null;
    this.settingsButton = null;
    this.minimizeButton = null;
    this.errorButton = null;
    this.iwidgetNameHTMLElement = null;
    this.iwidgetInputHTMLElement = null;
    this.statusBar = null;
    this.extractButton = null;

    // Icon element for the iconified mode
    this.iconElement = null;
    this.iconImg = null;
    this.iwidgetIconNameHTMLElement =  null;
    this.iconPosition = iconPosition;
    this.iconDraggable =  null;

    // Menu attributes
    this.extractOptionId = null;

    this.lowerOpId = null;
    this.raiseOpId = null;
    this.lowerToBottomOpId = null;
    this.raiseToTopOpId = null;

    // iWidget menu
    this.menu = null;

    // Add the iWidget to the layout
    this.build();
    layout.addIWidget(this, true);

    StyledElements.ObjectWithEvents.call(this, ['load', 'unload']);
    //this.menu_color = IWidgetColorManager.autogenColor(menu_color, this.code);

    this.prefCallback = null;
}
IWidget.prototype = new StyledElements.ObjectWithEvents();

/**
 * Returns the associated Widget.
 *
 * @returns {Widget} the associated Widget.
 */
IWidget.prototype.getWidget = function () {
    return this.widget;
};

IWidget.prototype.invalidIconPosition = function () {
    return this.iconPosition.x === -1 && this.iconPosition.y === -1;
};

/**
 * Sets the position of a widget instance. The position is calculated relative
 * to the top-left square of the widget instance box using cells units.
 *
 * @param {DragboardPosition} position the new position for the iWidget.
 */
IWidget.prototype.setPosition = function (position) {
    // Set a initial icon position (first time) or it still follows the widget (both positions are a reference to the same object)
    if (!this.iconPosition) {
        this.setIconPosition(new DragboardPosition(-1, -1));
    }
    if (this.onFreeLayout() && this.invalidIconPosition()) {
        this.setIconPosition(position);
    }

    this.position = position;

    if (this.element !== null) { // if visible
        this.element.style.left = this.layout.getColumnOffset(position.x) + "px";
        this.element.style.top = this.layout.getRowOffset(position.y) + "px";

        // Notify Context Manager about the new position
        var contextManager = this.layout.dragboard.getWorkspace().getContextManager();
        contextManager.notifyModifiedWidgetConcept(this, Concept.prototype.XPOSITION, this.position.x);
        contextManager.notifyModifiedWidgetConcept(this, Concept.prototype.YPOSITION, this.position.y);
    }
};

/**
 * Sets the position of the associated icon for this iWidget. The position must
 * be specified relative to the top-left square of the icon and using pixels
 * units.
 *
 * @param {DragboardPosition} position the new position for the iWidget icon
 */
IWidget.prototype.setIconPosition = function (position) {
    this.iconPosition = position.clone();
    if (this.iconElement) {
        this.iconElement.style.left = this.layout.dragboard.freeLayout.getColumnOffset(this.iconPosition.x) + "px";
        this.iconElement.style.top = this.layout.dragboard.freeLayout.getRowOffset(this.iconPosition.y) + "px";
    }
};

/**
 * Sets the z coordinate position of this iWidget.
 *
 * @param {Number} zPos the new Z coordinate position for the iWidget.
 */
IWidget.prototype.setZPosition = function (zPos) {
    this.zPos = zPos;

    zPos = zPos !== null ? zPos + 1: "";

    if (this.element) {
        this.element.style.zIndex = zPos;
    }
    if (this.iconElement) {
        this.iconElement.style.zIndex = zPos;
    }
};

/**
 * Gets the position of a widget instance. The position is calculated relative
 * to the top-left square of the widget instance box using cells units.
 *
 * @returns {DragboardPosition} the current position of the iWidget.
 */
IWidget.prototype.getPosition = function () {
    return this.position;
};

/**
 * Gets the position of a widget instance minimized. The position is calculated relative
 * to the top-left square of the widget instance box using cells units.
 *
 * @returns {DragboardPosition} the current position of the iWidget.
 */
IWidget.prototype.getIconPosition = function () {
    return this.iconPosition;
};

/**
 * Gets the z coordinate of this iWidget.
 *
 * @returns {Number} the Z coordinate of the iWidget.
 */
IWidget.prototype.getZPosition = function (zPos) {
    return this.zPos;
};

/**
 * Returns the content width in Layout Units.
 *
 * @returns {Number} the content width in cells.
 */
IWidget.prototype.getContentWidth = function () {
    return this.contentWidth;
};

/**
 * Returns the content height in Layout Units.
 *
 * @returns {Number} the content height in cells.
 */
IWidget.prototype.getContentHeight = function () {
    return this.contentHeight;
};

/**
 * Returns the Tab where this iWidget is displayed.
 *
 * @returns {Tab} associated tab
 */
IWidget.prototype.getTab = function () {
    return this.layout.dragboard.tab;
};

/**
 * Returns the current width of the widget in LU. This is not the same to the
 * content with as it depends in the current status of the iWidget (minimized,
 * with the configuration dialog, etc...)
 *
 * @returns {Number} the current width of the widget in LU
 *
 * @see DragboardLayout
 */
IWidget.prototype.getWidth = function () {
    // For now, the iwidget width is always the width of the iwidget content
    return this.contentWidth;
};

/**
 * Returns the current height of the widget in LU. This is not the same to the
 * iWidget's content height as it depends in the current status of the iWidget
 * (minimized, with the configuration dialog, etc...)
 *
 * @returns {Number} the current height of the widget in LU
 *
 * @see DragboardLayout
 */
IWidget.prototype.getHeight = function () {
    return this.height;
};

/**
 * Returns the identifier of this iWidget. This identifier is unique for the
 * current Wirecloud Platform. This identifier can be null if this iWidget is not
 * currently presisted.
 *
 * @returns {Number} the identifier for this iWidget.
 */
IWidget.prototype.getId = function () {
    return this.id;
};

IWidget.prototype.getElement = function () {
    return this.element;
};

/**
 * Returns true if the iWidget is currently visible in a dragboard.
 *
 * @returns {Boolean} true if the iWidget is currently visible; false otherwise.
 */
IWidget.prototype.isVisible = function () {
    return this.visible;
};

/**
 * Returns true if the iWidget is currently on the free layout of the dragboard.
 *
 * @returns {Boolean} true if the iWidget is currently on the free layout of the
 *                    associated dragboard; false otherwise.
 */
IWidget.prototype.onFreeLayout = function () {
    return this.layout.dragboard.freeLayout === this.layout;
};

/**
 * Toggle the widget transparency
 */
IWidget.prototype.toggleTransparency = function () {
    function onSuccess() {}
    function onError(transport, e) {
        var msg = gettext("Error saving the new transparency value into persistence: %(errorMsg)s.");
        msg = this.logManager.formatError(msg, transport, e);
        this.log(msg, Constants.Logging.ERROR_MSG);
    }

    this.element.toggleClassName("widget_window_transparent");
    this.transparency = !this.transparency;

    //Persist the new state
    var iwidgetUrl = Wirecloud.URLs.IWIDGET_ENTRY.evaluate({
        workspace_id: this.layout.dragboard.workspaceId,
        tab_id: this.layout.dragboard.tabId,
        iwidget_id: this.id
    });
    Wirecloud.io.makeRequest(iwidgetUrl, {
        method: 'PUT',
        contentType: 'application/json',
        postBody: Object.toJSON({
            transparency: this.transparency,
            id: this.id
        }),
        onSuccess: onSuccess,
        onFailure: onError
    });
};

/**
 * Builds the structure of the widget
 */
IWidget.prototype.build = function () {
    this.element = document.createElement("div");
    Element.extend(this.element);
    this.element.addClassName("iwidget");

    // Widget Menu
    this.widgetMenu = document.createElement("div");
    Element.extend(this.widgetMenu);
    this.widgetMenu.addClassName("widget_menu");
    this.widgetMenu.observe("contextmenu",
        function (e) {
            Event.stop(e);
        },
        true);

    // Widget title
    this.widgetMenu.setAttribute("title", this.name);

    //#######################################
    // buttons. Inserted from right to left
    //#######################################

    // close button
    this.closeButton = new StyledElements.StyledButton({
        'plain': true,
        'class': 'closebutton',
        'title': gettext('Close')
    });
    this.closeButton.addEventListener("click",
        function () {
            OpManagerFactory.getInstance().removeInstance(this.id);
        }.bind(this));
    this.closeButton.insertInto(this.widgetMenu);

    // Menu button
    this.settingsButton = new StyledElements.StyledButton({
        'plain': true,
        'class': 'settingsbutton',
        'title': gettext('Menu')
    });
    this.settingsButton.addEventListener("click",
        function (button) {
            this.menu.show(button.getBoundingClientRect());
        }.bind(this));
    this.settingsButton.insertInto(this.widgetMenu);

    // minimize button
    this.minimizeButton = new StyledElements.StyledButton({
        'plain': true
    });
    this.minimizeButton.addEventListener("click",
        function (button) {
            this.toggleMinimizeStatus(true);
        }.bind(this));
    this.minimizeButton.insertInto(this.widgetMenu);

    // error button
    this.errorButton = new StyledElements.StyledButton({
        'plain': true,
        'class': 'errorbutton'
    });
    this.errorButton.addEventListener("click",
        function (button) {
            OpManagerFactory.getInstance().showLogs(this.logManager); // TODO
        }.bind(this));
    this.errorButton.insertInto(this.widgetMenu);

    // New Version button
    this.upgradeButton = document.createElement("input");
    Element.extend(this.upgradeButton);
    this.upgradeButton.setAttribute("type", "button");
    this.upgradeButton.addClassName("button versionbutton disabled");
    Event.observe(this.upgradeButton, "click",
        function () {
            var msg = gettext('<p><b>Do you really want to update "%(iwidgetName)s" to its latest version?</b><br />The widget state and connections will be kept, if possible.<p>Note: It will reload your workspace</p>');
            msg = interpolate(msg, {iwidgetName: this.name}, true);
            LayoutManagerFactory.getInstance().showYesNoDialog(msg, this.upgradeIWidget.bind(this), this.askForIconVersion.bind(this));
        }.bind(this),
        false);
    this.widgetMenu.appendChild(this.upgradeButton);

    this.fillWithLabel();

    this.element.appendChild(this.widgetMenu);

    // Content wrapper
    this.contentWrapper = document.createElement("div");
    Element.extend(this.contentWrapper);
    this.contentWrapper.addClassName("widget_wrapper");
    this.element.appendChild(this.contentWrapper);

    // Widget Content
    this.content = document.createElement("iframe");
    Element.extend(this.content);
    this.content.addClassName("widget_object");
    this.content.setAttribute("type", this.widget.code_content_type);
    this.content.setAttribute("standby", "Loading...");
    this.content.setAttribute("width", "100%");
    this.content.setAttribute("frameBorder", "0");
    if (Prototype.Browser.Opera || Prototype.Browser.Safari) {
        this.content.setAttribute("src", this.codeURL);
    }

    Element.extend(this.content);
    this.content.observe("load",
        function () {
            this.layout.dragboard.workspace.iwidgetLoaded(this.id);
        }.bind(this),
        true);
    this.contentWrapper.appendChild(this.content);

    // Widget status bar
    this.statusBar = document.createElement("div");
    Element.extend(this.statusBar);
    this.statusBar.addClassName("statusBar");
    this.element.appendChild(this.statusBar);
    this.statusBar.observe("click", function () {
                                        this.layout.dragboard.raiseToTop(this);
                                    }.bind(this), false);

    // resize handles
    var resizeHandle;

    // Left one
    resizeHandle = document.createElement("div");
    Element.extend(resizeHandle);
    resizeHandle.addClassName("leftResizeHandle");
    this.leftResizeHandleElement = resizeHandle;
    this.leftResizeHandle = new IWidgetResizeHandle(resizeHandle, this, true);

    // Right one
    resizeHandle = document.createElement("div");
    Element.extend(resizeHandle);
    resizeHandle.addClassName("rightResizeHandle");
    this.statusBar.appendChild(resizeHandle);
    this.rightResizeHandleElement = resizeHandle;
    this.rightResizeHandle = new IWidgetResizeHandle(resizeHandle, this, false);

    // extract/snap button
    this.extractButton = document.createElement("div");
    Element.extend(this.extractButton);
    this.extractButton.className = "button";
    this.extractButton.observe("click",
        function () {
            this.toggleLayout();
        }.bind(this),
        false);
    this.statusBar.appendChild(this.extractButton);

    // wikilink
    this.wikilink = document.createElement('a');
    Element.extend(this.wikilink);
    this.wikilink.addClassName('dragboardwiki button');
    this.wikilink.href = this.widget.getUriWiki();
    this.wikilink.setAttribute('target', '_blank');
    this.wikilink.setAttribute('title', gettext('Access to Information'));
    this.statusBar.appendChild(this.wikilink);

    // Icon Element
    this.iconElement = document.createElement("div");
    Element.extend(this.iconElement);
    this.iconElement.addClassName("floating_widget_icon");

    this.iconImg = document.createElement("img");
    Element.extend(this.iconImg);
    this.iconImg.addClassName("floating_widget_img");
    this.iconImg.setAttribute("src", this.widget.getIcon());
    this.iconElement.appendChild(this.iconImg);

    // IE hack to allow drag & drop over images
    this.iconImg.ondrag = function () {
        return false;
    };

    this.iwidgetIconNameHTMLElement = document.createElement("a");
    Element.extend(this.iwidgetIconNameHTMLElement);
    this.iwidgetIconNameHTMLElement.update(this.name);
    this.iwidgetIconNameHTMLElement.addClassName("floating_widget_title");
    this.iconElement.appendChild(this.iwidgetIconNameHTMLElement);

    this.iwidgetIconNameHTMLElement.observe("click",
        function () {
            this.toggleMinimizeStatus(false);
            this.layout.dragboard.raiseToTop(this);
        }.bind(this),
        false);
};

IWidget.prototype.isAllowed = function (action) {
    switch (action) {
    case "close":
        return !this.readOnly && this.layout.dragboard.getWorkspace().isAllowed('add_remove_iwidgets');
    case "move":
    case "resize":
        var dragboard = this.layout.dragboard;
        return !dragboard.tab.readOnly && dragboard.getWorkspace().isAllowed('edit_layout');
    case "minimize":
        return this.layout.dragboard.getWorkspace().isAllowed('edit_layout');
    default:
        return false;
    }
};

IWidget.prototype._updateButtons = function () {
    this.closeButton.setDisabled(!this.isAllowed('close'));
    this.minimizeButton.setDisabled(!this.isAllowed('minimize'));

    if (isElement(this.leftResizeHandleElement.parentNode)) {
        this.leftResizeHandleElement.remove();
    }
    if (isElement(this.rightResizeHandleElement.parentNode)) {
        this.rightResizeHandleElement.remove();
    }


    if (this.isAllowed('resize')) {
        this.statusBar.appendChild(this.leftResizeHandleElement);
        this.statusBar.appendChild(this.rightResizeHandleElement);
    }
};

/**
 * Paints this widget instance into the assigned dragboard.
 *
 * @param {Boolean} onInit true if this widget is being painted on Dragboard
 *        initation.
 */
IWidget.prototype.paint = function (onInit) {
    if (this.visible) {
        return; // Do nothing if the iWidget is already painted
    }

    this.visible = true;

    // Initialize widget menu
    this.menu = new StyledElements.PopupMenu();
    this.menu.append(new IWidgetMenuItems(this));

    // Insert it into the dragboard (initially hidden)
    this.element.style.visibility = "hidden";
    this.layout.dragboard.dragboardElement.appendChild(this.element);

    if (!Prototype.Browser.Safari && !Prototype.Browser.Opera) {
        this.content.setAttribute("src", this.codeURL);
    }

    // Position
    this.element.style.left = this.layout.getColumnOffset(this.position.x) + "px";
    this.element.style.top = this.layout.getRowOffset(this.position.y) + "px";
    this.setZPosition(this.zPos);

    // Select the correct representation for this iWidget (iconified, minimized or normal)
    var minimizedStatusBackup = this.minimized;
    this.minimized = false;
    this._recomputeSize(false);

    this.minimized = null;
    this.setMinimizeStatus(minimizedStatusBackup, false, false);

    // Initialize transparency status
    if (this.transparency) {
        this.element.addClassName("widget_window_transparent");
    }

    //Initialize read-only status
    if (this.readOnly) {
        this.element.addClassName("widget_window_readonly");
    }

    // Time to show the iwidget (we need to take into account the widget can be iconified)
    if (!this.onFreeLayout() || !minimizedStatusBackup) {
        this.element.style.visibility = "";
    }

    // Mark as draggable
    this.draggable = new IWidgetDraggable(this);

    var contextManager = this.layout.dragboard.getWorkspace().getContextManager();

    // Notify Context Manager about the new position
    contextManager.notifyModifiedWidgetConcept(this, Concept.prototype.XPOSITION, this.position.x);
    contextManager.notifyModifiedWidgetConcept(this, Concept.prototype.YPOSITION, this.position.y);

    // Notify Context Manager about the new sizes
    contextManager.notifyModifiedWidgetConcept(this, Concept.prototype.HEIGHT, this.contentHeight);
    contextManager.notifyModifiedWidgetConcept(this, Concept.prototype.WIDTH, this.contentWidth);

    this._updateButtons();
    this._updateVersionButton();

    // Icon
    this.layout.dragboard.dragboardElement.appendChild(this.iconElement);
    this.iconDraggable = new IWidgetIconDraggable(this);
    this.iconElement.style.left = this.layout.dragboard.freeLayout.getColumnOffset(this.iconPosition.x) + "px";
    this.iconElement.style.top = this.layout.dragboard.freeLayout.getRowOffset(this.iconPosition.y) + "px";

    Event.observe(this.iconImg,
        "click",
        function () {
            this.setMinimizeStatus(false);
            this.layout.dragboard.raiseToTop(this);
        }.bind(this),
        true);
};

IWidget.prototype.load = function () {
    this.getTab().paint();
};

IWidget.prototype.isPainted = function () {
    return this.menu !== null;
};

IWidget.prototype.fillWithLabel = function () {
    if (this.iwidgetInputHTMLElement !== null) {
        //hide the input element
        this.iwidgetInputHTMLElement.hide();
    }

    // get the name
    var nameToShow = this.name;
    if (nameToShow.length > 30) {
        nameToShow = nameToShow.substring(0, 30) + "...";
    }

    if (this.iwidgetNameHTMLElement !== null) {
        // update and show the label
        this.iwidgetNameHTMLElement.update(nameToShow);
        this.iwidgetNameHTMLElement.show();
    } else {
        //create the label
        this.iwidgetNameHTMLElement = document.createElement("span");
        Element.extend(this.iwidgetNameHTMLElement);
        this.iwidgetNameHTMLElement.innerHTML = nameToShow;
        this.widgetMenu.appendChild(this.iwidgetNameHTMLElement);

        this.iwidgetNameHTMLElement.observe('mousedown', Event.stop);
        this.iwidgetNameHTMLElement.observe('click',
                                            function (e) {
                                                Event.stop(e);
                                                this.layout.dragboard.raiseToTop(this);
                                                this.fillWithInput();
                                            }.bind(this)); //do not propagate to div.
    }
};

IWidget.prototype.fillWithInput = function () {
    this.iwidgetNameHTMLElement.hide();
    if (this.iwidgetInputHTMLElement) {
        this.iwidgetInputHTMLElement.show();
        this.iwidgetInputHTMLElement.setAttribute("value", this.name);
        this.iwidgetInputHTMLElement.setAttribute("size", this.name.length + 5);
    } else {
        this.iwidgetInputHTMLElement = document.createElement("input");
        Element.extend(this.iwidgetInputHTMLElement);
        this.iwidgetInputHTMLElement.addClassName("iwidget_name");
        this.iwidgetInputHTMLElement.setAttribute("type", "text");
        this.iwidgetInputHTMLElement.setAttribute("value", this.name);
        this.iwidgetInputHTMLElement.setAttribute("size", this.name.length + 5);
        this.iwidgetInputHTMLElement.setAttribute("maxlength", 30);

        this.widgetMenu.appendChild(this.iwidgetInputHTMLElement);

        this.iwidgetInputHTMLElement.observe('blur',
                                            function (e) {
                                                Event.stop(e);
                                                var target = BrowserUtilsFactory.getInstance().getTarget(e);
                                                this.setName(target.value);
                                                this.fillWithLabel();
                                            }.bind(this));

        this.iwidgetInputHTMLElement.observe('keypress',
                                            function (e) {
                                                if (e.keyCode === Event.KEY_RETURN) {
                                                    Event.stop(e);
                                                    var target = BrowserUtilsFactory.getInstance().getTarget(e);
                                                    target.blur();
                                                }
                                            }.bind(this));

        this.iwidgetInputHTMLElement.observe('input',
                                            function (e) {
                                                var target;

                                                Event.stop(e);
                                                target = BrowserUtilsFactory.getInstance().getTarget(e);
                                                target.size = (target.value.length === 0) ? 1 : target.value.length + 5;
                                            }.bind(this));
    }
    this.iwidgetInputHTMLElement.focus();
};

/**
 * Sets the name of this iWidget. The name of the iWidget is shown at the
 * iWidget's menu bar. Also, this name will be used to refere to this widget in
 * other parts of the Wirecloud Platform, for example it is used in the wiring
 * interface.
 *
 * @param {String} iwidgetName New name for this iWidget.
 */
IWidget.prototype.setName = function (iwidgetName) {
    var oldName = this.name;

    function onSuccess() {
        var msg = gettext("Name changed from \"%(oldName)s\" to \"%(newName)s\" succesfully");
        msg = interpolate(msg, {oldName: oldName, newName: iwidgetName}, true);
        this.log(msg, Constants.Logging.INFO_MSG);
    }
    function onError(transport, e) {
        var msg = gettext("Error renaming iwidget from persistence: %(errorMsg)s.");
        msg = this.logManager.formatError(msg, transport, e);
        this.log(msg);
    }

    if (iwidgetName !== null && iwidgetName.length > 0) {
        this.name = iwidgetName;
        this.widgetMenu.setAttribute("title", iwidgetName);
        this.iwidgetNameHTMLElement.update(this.name);
        this.iwidgetIconNameHTMLElement.update(this.name);
        var iwidgetUrl = Wirecloud.URLs.IWIDGET_ENTRY.evaluate({
            workspace_id: this.layout.dragboard.workspaceId,
            tab_id: this.layout.dragboard.tabId,
            iwidget_id: this.id
        });
        Wirecloud.io.makeRequest(iwidgetUrl, {
            method: 'PUT',
            contentType: 'application/json',
            postBody: Object.toJSON({
                name: iwidgetName,
                id: this.id
            }),
            onSuccess: onSuccess.bind(this),
            onFailure: onError.bind(this)
        });
    }
};

/*
 * Perform the properly actions to show to the user that the widget has received and event
 */
IWidget.prototype.notifyEvent = function () {
    // if the iwidget is out of the grid it has to be raised to the top
    if (this.layout instanceof FreeLayout) {
        this.layout.dragboard.raiseToTop(this);
        //Moreover, if the iwidget is iconified it has to be opened
        if (this.isIconified()) {
            //maximize iconified widget
            this.toggleMinimizeStatus();
        }
    }
};

IWidget.prototype.isIconified = function () {
    return (this.layout instanceof FreeLayout && this.minimized);
};

/**
 * @private
 */
IWidget.prototype._updateVersionButton = function () {
    if (this.widget.isUpToDate() || this.isRefusedUpgrade()) {
        this.upgradeButton.addClassName('disabled');
    } else {
        var msg = gettext("There is a new version of this widget available. Current version: %(currentVersion)s - Last version: %(lastVersion)s");
        msg = interpolate(msg, {
                currentVersion: this.widget.getVersion().text,
                lastVersion: this.widget.getLastVersion().text
            }, true);

        this.upgradeButton.setAttribute("title", msg);
        this.upgradeButton.removeClassName('disabled');
    }
};

IWidget.prototype.askForIconVersion = function () {
    var msg = gettext('Do you want to remove the notice of the new version available?');
    msg = interpolate(msg, {iwidgetName: this.name}, true);
    LayoutManagerFactory.getInstance().showYesNoDialog(msg,
        function () {
            this.setRefusedVersion(this.widget.getLastVersion());
        }.bind(this));
};

IWidget.prototype.setRefusedVersion = function (v) {
    function onSuccess() {}
    function onError(transport, e) {
        var msg = gettext("Error setting the refused version of the iwidget to persistence: %(errorMsg)s.");
        msg = this.logManager.formatError(msg, transport, e);
        this.log(msg);
    }

    this.refusedVersion = v;
    $("version_button_" + this.id).hide();

    var iwidgetUrl = Wirecloud.URLs.IWIDGET_ENTRY.evaluate({
        workspace_id: this.layout.dragboard.workspaceId,
        tab_id: this.layout.dragboard.tabId,
        iwidget_id: this.id
    });
    Wirecloud.io.makeRequest(iwidgetUrl, {
        method: 'PUT',
        contentType: 'application/json',
        parameters: Object.toJSON({
            refused_version: this.refusedVersion.text,
            id: this.id
        }),
        onFailure: onError.bind(this)
    });
};

/**
 * Checks if the refused version is lower than the last one
 *
 * @returns {Boolean}
 */
IWidget.prototype.isRefusedUpgrade = function () {
    return this.refusedVersion && this.refusedVersion.compareTo(this.widget.getLastVersion()) === 0;
};

/**
 * Update the widget to its newest version
 */
IWidget.prototype.upgradeIWidget = function () {
    function onUpgradeOk(transport) {
        ShowcaseFactory.getInstance().reload(this.layout.dragboard.workspaceId);
    }

    function onUpgradeError(transport, e) {
        var msg = gettext('<p>Sorry but the "%(iwidgetName)s" widget <b>cannot be automatically updated</b> because its version is not compatible ' +
                'with the last version.<br/>If you want to update the widget you must replace <b>by hand</b> the existing one with the widget ' +
                'available in the catalogue.</p><b>Do you want to remove the notice of the new version available?</b>');
        msg = interpolate(msg, {iwidgetName: this.name}, true);
        LayoutManagerFactory.getInstance().showYesNoDialog(msg,
            function () {
                this.setRefusedVersion(this.widget.getLastVersion());
            }.bind(this));
    }

    var data = {
        id: this.id,
        newVersion: this.widget.getLastVersion().text,
        source: this.widget.getLastVersion().source
    };
    var url = Wirecloud.URLs.IWIDGET_VERSION_ENTRY.evaluate({
        workspace_id: this.layout.dragboard.workspaceId,
        tab_id: this.layout.dragboard.tabId,
        iwidget_id: this.id
    });

    Wirecloud.io.makeRequest(url, {
        method: 'PUT',
        onSuccess: onUpgradeOk.bind(this),
        onFailure: onUpgradeError.bind(this),
        onException: onUpgradeError.bind(this),
        postBody: Object.toJSON(data),
        contentType: 'application/json'
    });
};

IWidget.prototype.registerPrefCallback = function registerPrefCallback(prefCallback) {
    this.prefCallback = prefCallback;
};

/**
 * This method must be called to avoid memory leaks caused by circular references.
 */
IWidget.prototype.destroy = function destroy() {

    if (this.loaded) {
        this.events.unload.dispatch(this);
    }

    if (this.draggable !== null) {
        this.draggable.destroy();
        this.draggable = null;
    }

    if (this.leftResizeHandle !== null) {
        this.leftResizeHandle.destroy();
        this.leftResizeHandle = null;
    }

    if (this.rightResizeHandle !== null) {
        this.rightResizeHandle.destroy();
        this.rightResizeHandle = null;
    }

    if (this.menu) {
        this.menu.destroy();
        this.menu = null;
    }
    this.widget = null;
    this.layout = null;
    this.position = null;
    this.logManager.close();
    this.logManager = null;
};

/**
 * Removes this iwidget form the dragboard.
 *
 * @param {Boolean} orderFromServer true if his widget is being removed by Wirecloud
 *   server request.
 */
IWidget.prototype.remove = function (orderFromServer) {
    orderFromServer = orderFromServer !== null ? orderFromServer : false;

    if (this.layout === null) {
        return;
    }

    this.log(gettext('iWidget deleted'), Constants.Logging.INFO_MSG);

    var dragboard = this.layout.dragboard;
    if (isElement(this.element.parentNode)) {
        this.layout.removeIWidget(this, true);
    }

    this.element = null;

    if (!orderFromServer) {
        var onError = function (transport, e) {
            var msg, logManager;

            logManager = LogManagerFactory.getInstance();
            msg = logManager.formatError(gettext("Error removing iwidget from persistence: %(errorMsg)s."), transport, e);
            logManager.log(msg);
        };

        var uri = Wirecloud.URLs.IWIDGET_ENTRY.evaluate({
            workspace_id: dragboard.workspaceId,
            tab_id: dragboard.tabId,
            iwidget_id: this.id
        });
        Wirecloud.io.makeRequest(uri, {
            method: 'DELETE',
            onFailure: onError.bind(this)
        });
    }
};

/**
 * Sets the content size.
 *
 * @param {Number} newWidth
 * @param {Number} newHeight
 * @param {Boolean} [persist] default: true
 */
IWidget.prototype.setContentSize = function (newWidth, newHeight, persist) {
    persist = persist != null ? persist : true;

    if (!this.isPainted()) {
        this.contentWidth = newWidth;
        this.contentHeight = newHeight;
        return;
    }

    var oldHeight = this.getHeight();
    var oldWidth = this.getWidth();

    this.contentWidth = newWidth;
    this.contentHeight = newHeight;

    this._recomputeSize(true);

    // Notify resize event
    this.layout._notifyResizeEvent(this, oldWidth, oldHeight, this.getWidth(), this.getHeight(), false, persist);
};

/**
 * This function is called when the browser window is resized.
 *
 * @private
 */
IWidget.prototype._notifyWindowResizeEvent = function () {
    if (!this.isPainted()) {
        return;
    }

    /* TODO this is a temporally workaround needed when using display:none to hide tabs */
    var oldHeight = this.getHeight();
    var oldWidth = this.getWidth();
    /* TODO end of temporally workaround */

    // Recompute position
    this.element.style.left = this.layout.getColumnOffset(this.position.x) + "px";
    this.element.style.top = this.layout.getRowOffset(this.position.y) + "px";

    // Recompute size
    this._recomputeSize(true);

    /* TODO this is a temporally workaround needed when using display:none to hide tabs */
    // Notify new sizes if needed
    var newHeight = this.getHeight();
    var newWidth = this.getWidth();

    if ((oldHeight !== newHeight) || (oldWidth !== newWidth)) {
        this.layout._notifyResizeEvent(this, oldWidth, oldHeight, newWidth, newHeight, false, false);
    }
    /* TODO end of temporally workaround */
};

/**
 * This function is called when the content of the iwidget has been loaded completly.
 *
 * @private
 */
IWidget.prototype._notifyLoaded = function () {
    var msg, unloadElement, errorCount;

    msg = gettext('iWidget loaded');
    this.log(msg, Constants.Logging.INFO_MSG);

    if (this.loaded) {
        return;
    }

    this.loaded = true;

    errorCount = this.logManager.getErrorCount();
    if (errorCount > 0) {
        msg = ngettext("%(errorCount)s error for the iWidget \"%(name)s\" was notified before it was loaded",
                           "%(errorCount)s errors for the iWidget \"%(name)s\" were notified before it was loaded",
                           errorCount);
        msg = interpolate(msg, {errorCount: errorCount, name: this.name}, true);
        this.log(msg, Constants.Logging.WARN_MSG);
    }

    if (BrowserUtilsFactory.getInstance().isIE()) {
        unloadElement = this.content;
    } else {
        unloadElement = this.content.contentDocument.defaultView;
    }

    Event.observe(unloadElement,
        'unload',
        function () {
            OpManagerFactory.getInstance().iwidgetUnloaded(this.id);
        }.bind(this),
        true);

    // Check if the widget has its correct layout
    if (this.freeLayoutAfterLoading) {
        //Change the layout to extract the iwidget from the grid
        this.toggleLayout();
    }

    this.events['load'].dispatch(this);
};

/**
 * This function is called when the content of the iwidget is going to be unloaded.
 *
 * @private
 */
IWidget.prototype._notifyUnloaded = function () {
    var msg = gettext('iWidget unloaded');
    this.log(msg, Constants.Logging.INFO_MSG);
    this.logManager.newCycle();

    if (!this.loaded) {
        return;
    }

    this.errorButton.addClassName("disabled");
    this.errorButton.setTitle('');
    this.prefCallback = null;
    this.loaded = false;
    this.events['unload'].dispatch(this);
};

/**
 * @private
 */
IWidget.prototype._recomputeWidth = function () {
    var width = this.layout.getWidthInPixels(this.contentWidth);

    width -= this._computeExtraWidthPixels();

    if (width < 0) {
        width = 0;
    }

    this.element.style.width = width + "px";

    // Notify Context Manager
    var contextManager = this.layout.dragboard.getWorkspace().getContextManager();
    contextManager.notifyModifiedWidgetConcept(this, Concept.prototype.WIDTHINPIXELS, width);
};

/**
 * @private
 */
IWidget.prototype._recomputeWrapper = function (contentHeight) {
    var wrapperHeight;

    if (!this.minimized) {
        if (contentHeight) {
            wrapperHeight = contentHeight;
        } else {
            wrapperHeight = parseInt(this.content.offsetHeight, 10);
        }
    } else {
        wrapperHeight = 0;
    }

    this.contentWrapper.setStyle({height: wrapperHeight + "px"});
};

/**
 * @private
 */
IWidget.prototype._computeExtraWidthPixels = function () {
    var windowStyle, pixels;

    windowStyle = document.defaultView.getComputedStyle(this.element, null);

    pixels = windowStyle.getPropertyCSSValue("border-left-width").getFloatValue(CSSPrimitiveValue.CSS_PX);
    pixels += windowStyle.getPropertyCSSValue("border-right-width").getFloatValue(CSSPrimitiveValue.CSS_PX);

    return pixels;
};

/**
 * @private
 */
IWidget.prototype._computeExtraHeightPixels = function () {
    var windowStyle, menubarStyle, statusbarStyle, pixels;

    windowStyle = document.defaultView.getComputedStyle(this.element, null);

    pixels = windowStyle.getPropertyCSSValue("border-bottom-width").getFloatValue(CSSPrimitiveValue.CSS_PX);
    pixels += windowStyle.getPropertyCSSValue("border-top-width").getFloatValue(CSSPrimitiveValue.CSS_PX);

    menubarStyle = document.defaultView.getComputedStyle(this.widgetMenu, null);
    pixels += menubarStyle.getPropertyCSSValue("border-bottom-width").getFloatValue(CSSPrimitiveValue.CSS_PX);
    pixels += menubarStyle.getPropertyCSSValue("border-top-width").getFloatValue(CSSPrimitiveValue.CSS_PX);

    statusbarStyle = document.defaultView.getComputedStyle(this.statusBar, null);
    pixels += statusbarStyle.getPropertyCSSValue("border-bottom-width").getFloatValue(CSSPrimitiveValue.CSS_PX);
    pixels += statusbarStyle.getPropertyCSSValue("border-top-width").getFloatValue(CSSPrimitiveValue.CSS_PX);

    return pixels;
};

/**
 * @private
 */
IWidget.prototype._recomputeHeight = function (basedOnContent) {
    var contentHeight, contextManager, oldHeight;

    contextManager = this.layout.dragboard.getWorkspace().getContextManager();

    oldHeight = this.height;

    if (!this.minimized) {
        if (basedOnContent) {
            // Based on content height

            contentHeight = this.layout.fromVCellsToPixels(this.contentHeight);
            var fullSize = contentHeight;
            fullSize += this.widgetMenu.offsetHeight +
                        this.statusBar.offsetHeight;
            fullSize += this._computeExtraHeightPixels();

            var processedSize = this.layout.adaptHeight(contentHeight, fullSize);
            contentHeight = processedSize.inPixels;
            this.height = processedSize.inLU;
            this.content.setStyle({height: contentHeight + "px"});
        } else {
            // Based on full widget height
            contentHeight = this.layout.getHeightInPixels(this.height);
            contentHeight -= this.widgetMenu.offsetHeight + this.statusBar.offsetHeight;
            contentHeight -= this._computeExtraHeightPixels();

            if (contentHeight < 0) {
                contentHeight = 0;
            }

            this.content.setStyle({height: contentHeight + "px"});
            this.contentHeight = Math.floor(this.layout.fromPixelsToVCells(contentHeight));
        }

        this._recomputeWrapper(contentHeight);

        // Notify Context Manager about the new size
        contextManager.notifyModifiedWidgetConcept(this, Concept.prototype.HEIGHTINPIXELS, contentHeight);

    } else { // minimized
        this._recomputeWrapper();
        contentHeight = this.element.offsetHeight;
        this.content.setStyle({height: "0px"});
        this.height = Math.ceil(this.layout.fromPixelsToVCells(contentHeight));
    }

    if (oldHeight !== this.height) {
        // Notify Context Manager about new size
        contextManager.notifyModifiedWidgetConcept(this, Concept.prototype.HEIGHT, this.height);
    }
};

/**
 * @private
 */
IWidget.prototype._recomputeSize = function (basedOnContent) {
    this._recomputeWidth();
    this._recomputeHeight(basedOnContent);
};

/**
 * Sets the absolute size of the iwidget. See setContentSize for resizing the area for the iwidget content.
 *
 * @param {Number} newWidth the new width of this iwidget in cells. This will be
 *                          the final width for this widget.
 * @param {Number} newHeight the new height of this iwidget in cells. This will
 *                           be the final height for this widget (that is,
 *                           counting the iwidget's title bar, the configuration
 *                           form, etc)
 * @param {Boolean} [resizeLeftSide] true if the widget will be resized using
 *                                   the topRight corner as base point.
 *                                   default: false.
 * @param {Boolean} [persist] true if is needed to notify the new
 *                            widths/positions of the iWidget (then the
 *                            associated layout can move other iwidgets) to
 *                            persistence. default: true.
 */
IWidget.prototype.setSize = function (newWidth, newHeight, resizeLeftSide, persist) {
    // defaults values for the resizeLeftSide and persist parameters
    resizeLeftSide = resizeLeftSide !== undefined ? resizeLeftSide : false;
    persist = persist !== undefined ? persist : true;

    if (!this.isPainted()) {
        this.contentWidth = newWidth;
        this.height = newHeight;
        return;
    }

    var oldWidth = this.getWidth();
    var oldHeight = this.getHeight();

    // Assign new values
    this.contentWidth = newWidth;
    this.height = newHeight;

    // Recompute sizes
    this._recomputeSize(false);

    if (persist) {
        // Notify Context Manager new sizes
        var contextManager = this.layout.dragboard.getWorkspace().getContextManager();
        contextManager.notifyModifiedWidgetConcept(this, Concept.prototype.HEIGHT, this.contentHeight);
        contextManager.notifyModifiedWidgetConcept(this, Concept.prototype.WIDTH, this.contentWidth);
        contextManager.notifyModifiedWidgetConcept(this, Concept.prototype.HEIGHTINPIXELS, this.content.offsetHeight);
        contextManager.notifyModifiedWidgetConcept(this, Concept.prototype.WIDTHINPIXELS, this.content.offsetWidth);
    }

    // Notify resize event
    this.layout._notifyResizeEvent(this, oldWidth, oldHeight, this.contentWidth, this.height, resizeLeftSide, persist);
};

/**
 * Returns true if this iwidget is minimized.
 *
 * @returns {Boolean} true if the iWidget is minimized; false otherwise.
 */
IWidget.prototype.isMinimized = function () {
    return this.minimized;
};

/**
 * Changes minimize status of this iwidget
 *
 * @param newStatus new minimize status of the iwidget
 */
IWidget.prototype.setMinimizeStatus = function (newStatus, persistence, reserveSpace) {
    if (this.minimized === newStatus) {
        return; // Nothing to do
    }

    // TODO add effects?

    // New Status
    this.minimized = newStatus;

    if (this.minimized) {
        if (this.onFreeLayout()) {
            // Floating widget
            this.element.setStyle({"visibility": "hidden"});
            this.iconElement.setStyle({"display": "block"});
        } else {
            // Linked to the grid
            this.contentWrapper.setStyle({"visibility": "hidden", "border": "0px"});
            this.statusBar.setStyle({"display": "none"});
            this.minimizeButton.setTitle(gettext("Maximize"));
            this.minimizeButton.removeClassName("minimizebutton");
            this.minimizeButton.addClassName("maximizebutton");
        }
    } else {
        this.minimizeButton.setTitle(gettext("Minimize"));
        this.minimizeButton.removeClassName("maximizebutton");
        this.minimizeButton.addClassName("minimizebutton");
        this.contentWrapper.setStyle({"visibility": "", "border": ""});

        if (this.onFreeLayout()) {
            // Floating widget
            this.element.setStyle({"visibility": ""});
            this.iconElement.setStyle({"display": "none"});
        } else {
            //Linked to the grid
            this.statusBar.setStyle({"display": ""});
        }
    }

    var oldHeight = this.getHeight();
    this._recomputeHeight(true);

    // Notify resize event
    reserveSpace = (typeof reserveSpace !== 'undefined' && reserveSpace !== null) ? reserveSpace : true;
    if (reserveSpace) {
        var persist = persistence !== null ? persistence : true;
        this.layout._notifyResizeEvent(this, this.contentWidth, oldHeight, this.contentWidth, this.getHeight(), false, persist, reserveSpace);
    }
};

IWidget.prototype.isInFullDragboardMode = function () {
    return this.layout instanceof FullDragboardLayout;
};

IWidget.prototype.setFullDragboardMode = function (enable) {
    if (this.isInFullDragboardMode() === enable) {
        return;
    }

    var dragboard = this.layout.dragboard;

    if (enable) {
        this.previousContentWidth = this.contentWidth;
        this.previousHeight = this.height;
        this.previousLayout = this.layout;
        this.previousPosition = this.position.clone();

        this.moveToLayout(dragboard.fulldragboardLayout);
        dragboard.raiseToTop(this);
    } else {
        this.moveToLayout(this.previousLayout);
    }
};

/**
 * Toggles the minimize status of this widget
 */
IWidget.prototype.toggleMinimizeStatus = function (persistence) {
    this.setMinimizeStatus(!this.minimized, persistence);
};

/**
 * @private
 */
IWidget.prototype._updateErrorInfo = function () {
    var label, errorCount = this.logManager.getErrorCount();
    this.errorButton.setDisabled(errorCount == 0);

    label = ngettext("%(errorCount)s error", "%(errorCount)s errors", errorCount);
    label = interpolate(label, {errorCount: errorCount}, true);
    this.errorButton.setTitle(label);
};

/**
 * Logs a success
 */
IWidget.prototype.log = function (msg, level) {
    level = level != null ? level : Constants.Logging.ERROR_MSG;

    this.logManager.log(msg, level);
    if (this.isVisible()) {
        this._updateErrorInfo();
    }
};

IWidget.prototype.highlight = function () {
    if (this.isVisible()) {
        this.element.addClassName('highlighted');

        if (this.highlightTimeout !== null) {
            clearTimeout(this.highlightTimeout);
        }

        this.highlightTimeout = setTimeout(function () {
                this.element.removeClassName('highlighted');
                this.highlightTimeout = null;
            }.bind(this),
            15000);
    }
};

/**
 * Increments the error count for this iwidget
 */
IWidget.prototype.toggleLayout = function () {
    if (this.onFreeLayout()) {
        this.moveToLayout(this.layout.dragboard.baseLayout);
    } else {
        this.moveToLayout(this.layout.dragboard.freeLayout);
    }
};

/**
 * Check if the iwidget belongs to a shared workspace
 */
IWidget.prototype.is_shared_workspace = function () {
    return this.layout.dragboard.getWorkspace().isShared();
};

/**
 * Saves the iwidget into persistence. Used only for the first time, that is,
 * for creating iwidgets.
 */
IWidget.prototype.save = function (options) {
    function onSuccess(transport) {
        var iwidgetInfo = JSON.parse(transport.responseText);
        this.id = iwidgetInfo['id'];
        this.codeURL = this.widget.code_url + "#id=" + this.id;
        this.layout.dragboard.addIWidget(this, iwidgetInfo, options);
    }

    function onError(transport, e) {
        var logManager, msg;

        logManager = LogManagerFactory.getInstance();
        msg = logManager.formatError(gettext("Error adding iwidget to persistence: %(errorMsg)s."), transport, e);
        logManager.log(msg);

        this.destroy();
    }

    var url = Wirecloud.URLs.IWIDGET_COLLECTION.evaluate({
        tab_id: this.layout.dragboard.tabId,
        workspace_id: this.layout.dragboard.workspaceId
    });

    var data = Object.toJSON({
        'iwidget': {
            'widget': this.widget.getId(),
            'left': this.position.x,
            'top': this.position.y,
            'icon_left': this.iconPosition.x,
            'icon_top': this.iconPosition.y,
            'zIndex': this.zPos,
            'width': this.contentWidth,
            'height': this.contentHeight,
            'name': this.name,
            'layout': this.onFreeLayout() ? 1 : 0
        }
    });
    Wirecloud.io.makeRequest(url, {
        method: 'POST',
        contentType: 'application/json',
        postBody: data,
        onSuccess: onSuccess.bind(this),
        onFailure: onError.bind(this),
        onException: onError.bind(this)
    });
};

/**
 * This function migrates this iwidget form a layout to another
 *
 * @param {DragboardLayout} newLayout the layout where the iWidget will be moved
 *                          to.
 */
IWidget.prototype.moveToLayout = function (newLayout) {
    if (this.layout === newLayout) {
        return;
    }

    var affectedWidgetsRemoving = false;
    var affectedWidgetsAdding = false;      //is there any other widget's postion affected

    var minimizeOnFinish = false;
    if (this.minimized) {
        minimizeOnFinish = true;
        this.toggleMinimizeStatus();
    }

    // ##### TODO Review this
    var contentWidth = this.element.offsetWidth;
    var fullWidth = contentWidth;
    contentWidth -= this._computeExtraWidthPixels();

    var contentHeight = this.content.offsetHeight;
    var fullHeight = contentHeight;
    fullHeight += this.widgetMenu.offsetHeight +
                  this.statusBar.offsetHeight;
    fullHeight += this._computeExtraHeightPixels();
    // ##### END TODO

    var dragboardChange = this.layout.dragboard !== newLayout.dragboard;
    var oldLayout = this.layout;

    // Force an unload event
    if (dragboardChange) {
        OpManagerFactory.getInstance().iwidgetUnloaded(this.id);
    }

    affectedWidgetsRemoving = oldLayout.removeIWidget(this, dragboardChange);


    if (dragboardChange && !(newLayout instanceof FreeLayout)) {
        this.position = null;
    } else if (oldLayout instanceof FullDragboardLayout) {
        this.position = this.previousPosition;
    } else {
        this.position.x = oldLayout.getColumnOffset(this.position.x);
        this.position.x = newLayout.adaptColumnOffset(this.position.x).inLU;

        this.position.y = oldLayout.getRowOffset(this.position.y);
        this.position.y = newLayout.adaptRowOffset(this.position.y).inLU;
    }

    // ##### TODO Review this
    if (oldLayout instanceof FullDragboardLayout) {
        this.contentWidth = this.previousContentWidth;
        this.height = this.previousHeight;
    } else {
        //console.debug("prev width: " + this.contentWidth);
        var newWidth = newLayout.adaptWidth(contentWidth, fullWidth, oldLayout);
        this.contentWidth = newWidth.inLU;
        //console.debug("new width: " + this.contentWidth);

        //console.debug("prev height: " + this.height);
        var newHeight = newLayout.adaptHeight(contentHeight, fullHeight, oldLayout);
        this.height = newHeight.inLU;
        //console.debug("new height: " + this.height);
    }
    // ##### END TODO

    affectedWidgetsAdding = newLayout.addIWidget(this, dragboardChange);

    if (minimizeOnFinish) {
        this.toggleMinimizeStatus();
    }

    if (!this.loaded && BrowserUtilsFactory.getInstance().isIE()) {
        // IE hack to reload the iframe
        this.content.src = this.content.src;
    }

    if (!dragboardChange) {
        // This is needed to check if the scrollbar status has changed (visible/hidden)
        newLayout.dragboard._notifyWindowResizeEvent();
    }


    //if the widget hasn't been taken to another tab and
    //the movement affects the rest of widgets
    if (!dragboardChange && (affectedWidgetsRemoving || affectedWidgetsAdding)) {
        //commit all the dragboard changes
        this.layout.dragboard._commitChanges();
    } else {
        //commit only the info about this iwidget. If it has changed dragboards, it won't
        //affect the positions of the widgets of the new tab because it's placed at the
        //end of the dragboard. It won't either affect the old dragboard's widgets because
        //they will reallocate themselves and this will be notified in the next action.

        // TODO create a changes manager
        // Persistence
        var onSuccess = function (transport) {
        };

        var onError = function (transport, e) {
            var logManager, msg;

            logManager = LogManagerFactory.getInstance();
            msg = logManager.formatError(gettext("Error saving changes to persistence: %(errorMsg)s."), transport, e);
            logManager.log(msg);
        };

        var data = [];

        var iWidgetInfo = {};
        iWidgetInfo['id'] = this.id;
        if (!(newLayout instanceof FullDragboardLayout)) {
            iWidgetInfo['top'] = this.position.y;
            iWidgetInfo['left'] = this.position.x;
            iWidgetInfo['width'] = this.contentWidth;
            iWidgetInfo['height'] = this.contentHeight;
            iWidgetInfo['layout'] = this.onFreeLayout() ? 1 : 0;
            iWidgetInfo['fulldragboard'] = false;
        } else {
            iWidgetInfo['fulldragboard'] = true;
        }

        iWidgetInfo['icon_top'] = this.iconPosition.y;
        iWidgetInfo['icon_left'] = this.iconPosition.x;
        iWidgetInfo['zIndex'] = this.zPos;
        iWidgetInfo['tab'] = this.layout.dragboard.tabId;

        data.push(iWidgetInfo);

        var url = Wirecloud.URLs.IWIDGET_COLLECTION.evaluate({
            workspace_id: oldLayout.dragboard.workspaceId,
            tab_id: oldLayout.dragboard.tabId
        });
        Wirecloud.io.makeRequest(url, {
            method: 'PUT',
            contentType: 'application/json',
            postBody: Object.toJSON(data),
            onSuccess: onSuccess.bind(this),
            onFailure: onError.bind(this),
            contentType: 'application/json'
        });
    }
};