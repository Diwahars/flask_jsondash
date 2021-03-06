/**
 * Bootstrapping functions, event handling, etc... for application.
 */

 var dashboard_data = null;
 var chart_wall = null;
 var $API_ROUTE_URL = '[name="dataSource"]';
 var $API_PREVIEW = '#api-output';
 var $API_PREVIEW_BTN = '#api-output-preview';
 var $MODULE_FORM = '#module-form';
 var $VIEW_BUILDER = '#view-builder';
 var $ADD_MODULE = '#add-module';
 var $MAIN_CONTAINER = '#container';
 var $EDIT_MODAL = '#chart-options';
 var $DELETE_BTN = '#delete-widget';
 var $DELETE_DASHBOARD = '.delete-dashboard';
 var $SAVE_MODULE = '#save-module';

 function previewAPIRoute(e) {
    e.preventDefault();
    // Shows the response of the API field as a json payload, inline.
    $.ajax({
        type: 'get',
        url: $($API_ROUTE_URL).val().trim(),
        success: function(d) {
           $($API_PREVIEW).html(prettyCode(d));
        },
        error: function(d, status, error) {
            $($API_PREVIEW).html(error);
        }
    });
}

function refreshableType(type) {
    if(type === 'youtube') return false;
    return true;
}

function saveModule(e){
    var data     = serializeToJSON($($MODULE_FORM).serializeArray());
    var last     = $('.modules').find('input').last();
    var newfield = $('<input class="form-control" type="text">');
    var id = guid();
    // Add a unique guid for referencing later.
    data['guid'] = id;
    if(!data.refresh || !refreshableType(data.type)) data['refresh'] = false;
    if(!data.override) data['override'] = false;
    newfield.attr('name', 'module_' + id);
    newfield.val(JSON.stringify(data));
    $('.modules').append(newfield);
    // Add new visual block to view grid
    addWidget($VIEW_BUILDER, data);
    // Refit the grid
    chart_wall.fitWidth();
}

function isModalButton(e) {
    return e.relatedTarget.id === $ADD_MODULE.replace('#', '');
}

function updateEditForm(e) {
    var module_form = $($MODULE_FORM);
    // If the modal caller was the add modal button, skip populating the field.
    if(isModalButton(e)) {
        module_form.find('input').each(function(k, input){
            $(input).val('');
        });
        $($API_PREVIEW).empty();
        $($DELETE_BTN).hide();
        return;
    }
    $($DELETE_BTN).show();
    // Updates the fields in the edit form to the active widgets values.
    var data = $(e.relatedTarget).closest('.item.widget').data();
    var guid = data.guid;
    var module = getModuleByGUID(guid);
    // Update the modal window fields with this one's value.
    $.each(module, function(field, val){
        if(field === 'override' || field === 'refresh') {
            module_form.find('[name="' + field + '"]').prop('checked', val);
        } else {
            module_form.find('[name="' + field + '"]').val(val);
        }
    });
    // Update with current guid for referencing the module.
    module_form.attr('data-guid', guid);
}

function updateModule(e){
    var module_form = $($MODULE_FORM);
    // Updates the module input fields with new data by rewriting them all.
    var guid = module_form.attr('data-guid');
    var active = getModuleByGUID(guid);
    // Update the modules values to the current input values.
    module_form.find('input').each(function(k, input){
        var name = $(input).attr('name');
        if(name) {
            if(name === 'override' || name === 'refresh') {
                // Convert checkbox to json friendly format.
                active[name] = $(input).is(':checked');
            } else {
                active[name] = $(input).val();
            }
        }
    });
    // Update bar chart type
    var chart_type = module_form.find('select');
    active[chart_type.attr('name')] = chart_type.val();
    $('.modules').empty();
    $.each(dashboard_data.modules, function(k, module){
        var val = JSON.stringify(module, module);
        var input = $('<input type="text" name="module_' + k + '" class="form-control">');
        input.val(val);
        $('.modules').append(input);
    });
    // Trigger update form into view since data is dirty
    $('#edit-view-container').collapse('in');
}

function refreshWidget(e) {
    e.preventDefault();
    var container = $(this).closest('.widget');
    var guid = container.attr('data-guid');
    var config = getModuleByGUID(guid);
    var widget = addWidget($MAIN_CONTAINER, config);
    loadWidgetData(widget, config);
}

function addChartContainers(container, data) {
    for(var name in data.modules){
        // Closure to maintain each chart data value in loop
        (function(config){
            var config = data.modules[name];
            // Add div wrappers for js grid layout library,
            // and add title, icons, and buttons
            var widget = addWidget(container, config);
            // Determine how to load this widget
            loadWidgetData(widget, config);
        })(data.modules[name]);
    }
    initGrid($MAIN_CONTAINER);
}

function getModuleByGUID(guid) {
    return dashboard_data.modules.find(function(n){return n['guid'] === guid});
}

function deleteModule(e) {
    e.preventDefault();
    if(!confirm('Are you sure?')) return;
    var guid = $($MODULE_FORM).attr('data-guid');
    var module = getModuleByGUID(guid);
    // Remove form input and visual widget
    $('.modules').find('#' + guid).remove();
    $('.item.widget[data-guid="' + guid + '"]').remove();
    $($EDIT_MODAL).modal('hide');
    // Redraw wall to replace visual 'hole'
    chart_wall.fitWidth();
    // Trigger update form into view since data is dirty
    $('#edit-view-container').collapse('in');
}

function addDomEvents() {
    initGrid($VIEW_BUILDER);
    // TODO: debounce/throttle
    $($API_ROUTE_URL).on('change.charts', previewAPIRoute);
    $($API_PREVIEW_BTN).on('click.charts', previewAPIRoute);
    // Save module popup form
    $($SAVE_MODULE).on('click.charts.module', saveModule);
    // Edit existing modules
    $($EDIT_MODAL).on('show.bs.modal', updateEditForm);
    $('#update-module').on('click.charts.module', updateModule);
    // Allow swapping of edit/update events
    // for the add module button and form modal
    $($ADD_MODULE).on('click.charts', function(){
        $('#update-module')
        .attr('id', $SAVE_MODULE.replace('#', ''))
        .text('Save module')
        .off('click.charts.module')
        .on('click.charts', saveModule);
    });
    // Allow swapping of edit/update events
    // for the edit button and form modal
    $('.widget-edit').on('click.charts', function(){
        $($SAVE_MODULE)
        .attr('id', 'update-module')
        .text('Update module')
        .off('click.charts.module')
        .on('click.charts', updateModule);
    });
    // Add delete button for existing widgets.
    $($DELETE_BTN).on('click.charts', deleteModule);
    // Add delete confirm for dashboards.
    $($DELETE_DASHBOARD).on('submit.charts', function(e){
        if(!confirm('Are you sure?')) e.preventDefault();
    });
}

function togglePanel(e) {
    e.preventDefault();
    var el = $(this).attr('href');
    $(el).toggleClass('open');
}

function initGrid(container) {
    // http://vnjs.net/www/project/freewall/#options
    chart_wall = new freewall(container);
    chart_wall.reset({
        selector: '.item',
        delay: 1,
        fixSize: 1, // Important! Fixes the widgets to their configured size.
        gutterX: 4,
        gutterY: 4,
        draggable: false,
        onResize: function() {
            chart_wall.fitWidth();
        }
    });
    chart_wall.fitWidth();
}

function loader(container) {
    container.select('.widget-loader').classed({hidden: false});
}

function unload(container) {
    container.select('.widget-loader').classed({hidden: true});
}

function loadWidgetData(widget, config) {
    loader(widget);
    try {
        if(config.type === 'datatable') {
            _handleDataTable(widget, config);
        }
        else if(isSparkline(config.type)) {
            _handleSparkline(widget, config);
        }
        else if(config.type === 'iframe') {
            _handleIframe(widget, config);
        }
        else if(config.type === 'timeline') {
            _handleTimeline(widget, config);
        }
        else if(config.type === 'venn') {
            _handleVenn(widget, config);
        }
        else if(config.type === 'number') {
            _handleSingleNum(widget, config);
        }
        else if(config.type === 'youtube') {
            _handleYoutube(widget, config);
        }
        else if(config.type === 'custom') {
            _handleCustom(widget, config);
        }
        else if(isD3Subtype(config)) {
            _handleD3(widget, config);
        } else {
            _handleC3(widget, config);
        }
    } catch(e) {
        if(console && console.error) console.error(e);
        unload(widget);
    }
}

function prettyCode(code) {
    return JSON.stringify(JSON.parse(code), null, 4)
}

function addRefreshers(modules) {
    $.each(modules, function(k, module){
        if(module.refresh && module.refreshInterval) {
            var container = d3.select('[data-guid="' + module.guid + '"]');
            setInterval(function(){
                loadWidgetData(container, module);
            }, parseInt(module.refreshInterval, 10));
        }
    });
}

function loadDashboard(data) {
    addChartContainers($MAIN_CONTAINER, data);
    dashboard_data = data;

    // Add event handlers for widget UI
    $('.widget-refresh').on('click.charts', refreshWidget);

    // Setup refresh intervals for all widgets that specify it.
    addRefreshers(data.modules);

    // Format json config display
    $('#json-output').on('show.bs.modal', function(e){
        var code = $(this).find('code').text();
        $(this).find('code').text(prettyCode(code));
    });

    // Reformat the code inside of the raw json field, to pretty print
    // for the user.
    $('#raw-config').text(prettyCode($('#raw-config').text()));

    // Setup responsive handlers
    var jres = jRespond([
    {
        label: 'handheld',
        enter: 0,
        exit: 767
    }
    ]);
    jres.addFunc({
        breakpoint: 'handheld',
        enter: function() {
            $('.widget').css({
                'max-width': '100%',
                'width': '100%',
                'position': 'static'
            });
        }
    });
}
