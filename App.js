var Ext = window.Ext4 || window.Ext;
Ext.define('CustomApp', {
    extend: 'Rally.app.App',
    componentCls: 'app',
    launch: function() {
        this._grid = null;
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
    },
    
    _onPICombobox: function() {
        console.log("grid: ", this._grid);
        if (this._grid) {
            this._grid.destroy();
        }
        
        var selectedType = this._piCombobox.getRecord();
        Ext.create('Rally.data.wsapi.TreeStoreBuilder').build({
            models: selectedType.get('TypePath'),
            listeners: {
                load: function(store) {
                    var records = store.getRootNode().childNodes;
                    console.log("records: ", records);
                    this._calculateScore(records);
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
        var modelNames = selectedType.get('TypePath'),
        context = this.getContext();
        this._grid = this.add({
            xtype: 'rallygridboard',
            context: context,
            modelNames: modelNames,
            toggleState: 'grid',
            stateful: false,
            plugins: [
                {
                    ptype: 'rallygridboardcustomfiltercontrol',
                    filterControlConfig: {
                        modelNames: modelNames,
                        stateful: true,
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
