var Ext = window.Ext4 || window.Ext;
Ext.define('CustomApp', {
    extend: 'Rally.app.App',
    componentCls: 'app',
    launch: function() {
        this._grid = null;
        this._boxcontainer = Ext.create('Ext.form.Panel', {
            title: 'Grid Filters',
            layout: { type: 'hbox'},
            width: '95%',
            bodyPadding: 10
        });
        this._piCombobox = this.add({
            xtype: "rallyportfolioitemtypecombobox",
            padding: 5,
            listeners: {
                //ready: this._onPICombobox,
                select: this._onPICombobox,
                scope: this
            }
        });
     
        this._checkbox = this.add({
            xtype: 'rallycheckboxfield',
            fieldLabel: 'Show Values After the Decimal',
            labelWidth: 200,
            padding: '5, 5, 5, 10',
            stateful: true,
            stateId: this.getContext().getScopedStateId('mycheckbox'),
            stateEvents: ['change'],
            value: false,
            listeners: {
                change: this._onPICombobox,
                scope: this
            }
        });
        this._boxcontainer.add(this._piCombobox);
        this._boxcontainer.add(this._checkbox);
        this.add(this._boxcontainer);
    },
    
    _onPICombobox: function() {
        console.log("grid: ", this._grid);
        var selectedType = this._piCombobox.getRecord();
        var model = selectedType.get('TypePath');
        
        if (this._grid !== null) {
            this._grid.destroy();
        }
        console.log("creating tree store");
        Ext.create('Rally.data.wsapi.TreeStoreBuilder').build({
            models: [ model ],
            listeners: {
                load: function(store) {
                    var records = store.getRootNode().childNodes;
                    console.log("loading");
                    this._calculateScore(records);
                },
                update: function(store, rec, modified, opts) {
                    console.log("updating");
                    this._calculateScore([rec]);
                },
                scope: this
            },
            autoLoad: true,
            enableHierarchy: false
        }).then({
            success: this._onStoreBuilt,
            scope: this
        });
    },
    
    _onStoreBuilt: function(store, records) {
        var selectedType = this._piCombobox.getRecord();
        //console.log("PI type: ", selectedType.get('TypePath'));
        var modelNames = selectedType.get('TypePath');
        console.log("modelNames: ", modelNames);
        
        var context = this.getContext();
        this._grid = this.add({
            xtype: 'rallygridboard',
            context: context,
            modelNames: [ modelNames ],
            toggleState: 'grid',
            stateful: false,
            plugins: [
                {
                    ptype: 'rallygridboardcustomfiltercontrol',
                    filterControlConfig: {
                        modelNames: [ modelNames ],
                        stateful: true,
                        filterChildren: false,
                        stateId: context.getScopedStateId('custom-filter-example')
                    }
                },
                {
                    ptype: 'rallygridboardactionsmenu',
                    menuItems: [
                        {
                            text: 'Export...',
                            handler: function() {
                                window.location = Rally.ui.grid.GridCsvExport.buildCsvExportUrl(
                                    this.down('rallygridboard').getGridOrBoard());
                            },
                            scope: this
                        }
                    ],
                    buttonConfig: {
                        iconCls: 'icon-export'
                    }
                }
            ],
            gridConfig: {
                store: store,
                columnCfgs: [
                    {
                        text: "Portfolio ID",
                        dataIndex: "FormattedID",
                        flex: 1,
                        xtype: "templatecolumn",
                        tpl: Ext.create("Rally.ui.renderer.template.FormattedIDTemplate")
                    }, 
                    'Name',
                    "TimeCriticality", "RROEValue", "UserBusinessValue", "JobSize", 
                    {
                        text: "WSJF Score",
                        dataIndex: "WSJFScore",
                        editor: null
                    }
                ]
            },
            height: this.getHeight()
        });
    },
    
    _calculateScore: function(records)  {
        var that = this;
        Ext.Array.each(records, function(feature) {
            //console.log("feature", feature.data);
            var jobSize = feature.data.JobSize;
            var timeValue = feature.data.TimeCriticality;
            var OERR = feature.data.RROEValue;
            var userValue = feature.data.UserBusinessValue;
            var oldScore = feature.data.WSJFScore;
            var isChecked = false;
            if( that._checkbox) {
                isChecked = that._checkbox.getValue();
            }
            
            if (jobSize > 0) { // jobSize is the denominator so make sure it's not 0
                var score;
    
                if( !isChecked ) {
                    score = Math.floor(((userValue + timeValue + OERR ) / jobSize) + 0.5);
                }
                else {
                    score = Math.floor(((userValue + timeValue + OERR ) / jobSize) * 100)/100;
                }

                if (oldScore !== score) { // only update if score changed
                    feature.set('WSJFScore', score); // set score value in db
                }
            }
        });
    }
});
