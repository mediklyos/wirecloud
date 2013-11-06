/*
 *     DO NOT ALTER OR REMOVE COPYRIGHT NOTICES OR THIS HEADER
 *
 *     Copyright (c) 2012-2013 Universidad Politécnica de Madrid
 *     Copyright (c) 2012-2013 the Center for Open Middleware
 *
 *     Licensed under the Apache License, Version 2.0 (the
 *     "License"); you may not use this file except in compliance
 *     with the License.  You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 *     Unless required by applicable law or agreed to in writing,
 *     software distributed under the License is distributed on an
 *     "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 *     KIND, either express or implied.  See the License for the
 *     specific language governing permissions and limitations
 *     under the License.
 */

/*global opManager, Variable, Wirecloud */

(function () {

    "use strict";

    /*************************************************************************
     * Constructor
     *************************************************************************/
    /*
     * WidgetInterface Class
     */
    var WidgetInterface = function WidgetInterface(wiringEditor, iwidget, manager, isMenubarRef, endPointsPos) {
        var variables, variable, desc, label, name, anchorContext, i, wids;
        this.iwidget = iwidget;
        this.wiringEditor = wiringEditor;

        Wirecloud.ui.WiringEditor.GenericInterface.call(this, false, wiringEditor, this.iwidget.name, manager, 'iwidget');

        if (!isMenubarRef) {
            if ((endPointsPos.sources.length === 0) && (endPointsPos.targets.length === 0)) {
                wids = opManager.activeWorkspace.getIWidgets();
                endPointsPos.sources = wids[wids.indexOf(iwidget)].getWidget().getTemplate().getConnectables().outputs.slice();
                endPointsPos.targets = wids[wids.indexOf(iwidget)].getWidget().getTemplate().getConnectables().inputs.slice();
                for (i = 0; i < endPointsPos.sources.length; i ++) {
                    endPointsPos.sources[i] = endPointsPos.sources[i].name;
                }
                for (i = 0; i < endPointsPos.targets.length; i ++) {
                    endPointsPos.targets[i] = endPointsPos.targets[i].name;
                }
            }
            variables = opManager.activeWorkspace.varManager.getIWidgetVariables(iwidget.getId());
            for (i = 0; i < endPointsPos.sources.length; i ++) {
                variable = variables[endPointsPos.sources[i]];
                desc = variable.vardef.description;
                label = variable.vardef.label;
                anchorContext = {'data': variable, 'iObject': this};
                this.addSource(label, desc, variable.vardef.name, anchorContext);
            }
            for (i = 0; i < endPointsPos.targets.length; i ++) {
                variable = variables[endPointsPos.targets[i]];
                desc = variable.vardef.description;
                label = variable.vardef.label;
                anchorContext = {'data': variable, 'iObject': this};
                this.addTarget(label, desc, variable.vardef.name, anchorContext);
            }
        }
    };

    WidgetInterface.prototype = new Wirecloud.ui.WiringEditor.GenericInterface(true);

    /**
     * onFinish for draggable
     */
    WidgetInterface.prototype.onFinish = function onFinish(draggable, data, e) {
        var position, initialPosition, movement, iwidget_interface, endPointPos, oc, scrollX, scrollY;

        position = {posX: 0, posY: 0};
        position = data.iObjectClon.getPosition();

        if (!this.wiringEditor.withinGrid(e)) {
            this.wiringEditor.layout.wrapperElement.removeChild(data.iObjectClon.wrapperElement);
            return;
        }

        //scroll correction
        oc = this.wiringEditor.layout.getCenterContainer();
        scrollX = parseInt(oc.wrapperElement.scrollLeft, 10);
        scrollY = parseInt(oc.wrapperElement.scrollTop, 10);
        position.posX += scrollX;
        position.posY += scrollY;

        endPointPos = {'sources': [], 'targets': []};
        iwidget_interface = this.wiringEditor.addIWidget(this.wiringEditor, this.iwidget, endPointPos);

        position.posX -= this.wiringEditor.getGridElement().getBoundingClientRect().left;

        if (position.posX < 0) {
            position.posX = 8;
        }
        if (position.posY < 0) {
            position.posY = 8;
        }
        iwidget_interface.setPosition(position);
        this.wiringEditor.layout.wrapperElement.removeChild(data.iObjectClon.wrapperElement);
        this.disable();
    };

    /*************************************************************************
     * Private methods
     *************************************************************************/

     /*************************************************************************
     * Public methods
     *************************************************************************/

    /**
     * get the iwidget.
     */
    WidgetInterface.prototype.getIWidget = function getIWidget() {
        return this.iwidget;
    };

    /*************************************************************************
     * Make WidgetInterface public
     *************************************************************************/
    Wirecloud.ui.WiringEditor.WidgetInterface = WidgetInterface;
})();
