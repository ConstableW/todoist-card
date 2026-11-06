import {LitElement, html, css} from 'https://cdn.jsdelivr.net/npm/lit@3.2.1/+esm';

const NEW_SECTION = '__new_section__';

class TodoistCardEditor extends LitElement {
    static get properties() {
        return {
            hass: Object,
            config: Object,
        };
    }

    setConfig(config) {
        this.config = config;
    }

    get _fields() {
        return [
            {name: 'entity', required: true, selector: {entity: {domain: ['todo', 'sensor']}}},
            {
                name: 'mode',
                selector: {
                    select: {
                        mode: 'dropdown',
                        options: [
                            {value: 'quick', label: 'Quick (complete and delete only)'},
                            {value: 'extended', label: 'Extended (click a task to edit it)'},
                        ],
                    },
                },
            },
            {name: 'show_completed', selector: {number: {min: 0, max: 15, mode: 'box'}}},
            {name: 'show_header', selector: {boolean: {}}},
            {
                name: 'header_stats',
                selector: {
                    select: {
                        mode: 'dropdown',
                        options: [
                            {value: 'none', label: 'None'},
                            {value: 'chips', label: 'Chips (overdue, today, open, completed)'},
                            {value: 'line', label: 'One line with progress bar'},
                        ],
                    },
                },
            },
            {name: 'show_sections', selector: {boolean: {}}},
            {name: 'show_item_add', selector: {boolean: {}}},
            {name: 'use_quick_add', selector: {boolean: {}}},
            {name: 'show_item_close', selector: {boolean: {}}},
            {name: 'show_item_delete', selector: {boolean: {}}},
            {name: 'only_today_overdue', selector: {boolean: {}}},
        ];
    }

    // What the selected entity can do. Options that cannot work are not shown.
    _capabilities() {
        const entity = (this.config && this.config.entity) || '';

        if (!entity) {
            return {kind: 'none'};
        }

        if (entity.startsWith('todo.')) {
            return {kind: 'todo', tasks: true, write: true, sections: false, quickAdd: false};
        }

        const state = this.hass.states[entity];
        if (!state) {
            return {kind: 'missing'};
        }

        const write = !!(this.hass.services.rest_command && this.hass.services.rest_command.todoist);

        return {
            kind: 'rest',
            tasks: !!(state.attributes.items || state.attributes.tasks),
            sections: !!state.attributes.sections,
            write,
            quickAdd: write,
        };
    }

    _visible(name, caps) {
        if (name === 'entity') {
            return true;
        }
        if (!caps.tasks) {
            return false;
        }

        switch (name) {
            case 'show_sections':
                return caps.sections;
            case 'use_quick_add':
                return caps.quickAdd;
            case 'mode':
            case 'show_completed':
            case 'show_item_add':
            case 'show_item_close':
            case 'show_item_delete':
                return caps.write;
            default:
                return true;
        }
    }

    _hint(caps) {
        const entity = (this.config && this.config.entity) || '';

        switch (caps.kind) {
            case 'none':
                return {
                    type: 'info',
                    text: 'Choose a todo entity of the Todoist integration (basic mode, no setup needed) '
                        + 'or the REST sensor from the README (all features).',
                };
            case 'missing':
                return {type: 'warning', text: 'The entity ' + entity + ' was not found.'};
            case 'todo':
                return {
                    type: 'info',
                    text: 'Basic mode (Todoist integration): tasks, add, complete, rename, date, description and delete. '
                        + 'Sections, priority, labels and Quick Add need the REST setup, see the README.',
                };
        }

        if (!caps.tasks) {
            return {
                type: 'warning',
                text: 'This sensor provides no tasks. Add items or tasks to json_attributes of the sensor and check '
                    + 'the project ID, see the README (Setup). Until then no options are available.',
            };
        }

        const missing = [];
        if (!caps.write) {
            missing.push('rest_command.todoist (needed to add, complete, edit and delete tasks, so these options are hidden)');
        }
        if (!caps.sections) {
            missing.push('the sections attribute of the sensor (needed for sections)');
        }

        return missing.length
            ? {
                type: 'warning',
                text: 'The REST setup is incomplete. Missing: ' + missing.join(', ')
                    + '. See the README (Setup), or choose a todo entity of the Todoist integration.',
            }
            : null;
    }

    get _data() {
        return {
            mode: 'quick',
            show_completed: 5,
            show_header: true,
            header_stats: 'none',
            show_sections: true,
            show_item_add: true,
            use_quick_add: false,
            show_item_close: true,
            show_item_delete: true,
            only_today_overdue: false,
            ...this.config,
        };
    }

    _label(schema) {
        const labels = {
            entity: 'Entity (required)',
            mode: 'Mode',
            show_completed: 'Number of completed tasks shown at the end of the list (0 to disable)',
            show_header: 'Show header',
            header_stats: 'Statistics in the header',
            show_sections: 'Group tasks by Todoist sections (collapsible)',
            show_item_add: 'Show text input element for adding new items to the list',
            use_quick_add: 'Use Quick Add (check the README configuration before enabling)',
            show_item_close: 'Show "close/complete" and "uncomplete" buttons',
            show_item_delete: 'Show "delete" buttons',
            only_today_overdue: 'Only show today or overdue',
        };

        return labels[schema.name] || schema.name;
    }

    _valueChanged(e) {
        const config = {...e.detail.value};
        const caps = this._capabilities();

        // Without rest_command.todoist nothing can be changed, so the actions are switched off in the config.
        if (caps.kind === 'rest' && caps.tasks && !caps.write) {
            config.show_item_add = false;
            config.show_item_close = false;
            config.show_item_delete = false;
            config.use_quick_add = false;
        }

        this.config = config;
        this.dispatchEvent(new CustomEvent('config-changed', {
            detail: {config},
            bubbles: true,
            composed: true,
        }));
    }

    render() {
        if (!this.hass || !this.config) {
            return html``;
        }

        const caps = this._capabilities();
        const fields = this._fields.filter(field => this._visible(field.name, caps));
        const top = fields.filter(field => field.name === 'entity');
        const rest = fields.filter(field => field.name !== 'entity');
        const hint = this._hint(caps);

        return html`<ha-form
                .hass=${this.hass}
                .data=${this._data}
                .schema=${top}
                .computeLabel=${(schema) => this._label(schema)}
                @value-changed=${this._valueChanged}
            ></ha-form>
            ${hint ? html`<div class="hint ${hint.type}">${hint.text}</div>` : html``}
            ${rest.length
                ? html`<ha-form
                    .hass=${this.hass}
                    .data=${this._data}
                    .schema=${rest}
                    .computeLabel=${(schema) => this._label(schema)}
                    @value-changed=${this._valueChanged}
                ></ha-form>`
                : html``}`;
    }

    static get styles() {
        return css`
            .hint {
                margin: 16px 0;
                padding: 12px 16px;
                border-radius: 8px;
                border-left: 4px solid var(--info-color, #039be5);
                background: var(--secondary-background-color);
                color: var(--primary-text-color);
                font-size: 14px;
            }

            .hint.warning {
                border-left-color: var(--warning-color, #ffa600);
            }

            .hint.success {
                border-left-color: var(--success-color, #43a047);
            }
        `;
    }
}


class TodoistCardDialog extends LitElement {
    static get properties() {
        return {
            hass: Object,
            item: Object,
            sections: Array,
            onSave: Object,
            onComplete: Object,
            onDelete: Object,
            readonly: Boolean,
            _data: Object,
            _busy: Boolean,
            _error: String,
        };
    }

    constructor() {
        super();

        this.sections = [];
        this._busy = false;
        this._error = '';
        this._onKeydown = (e) => {
            if (e.key === 'Escape' && !this.getRootNode().querySelector('todoist-card-confirm')) {
                this.close();
            }
        };
    }

    connectedCallback() {
        super.connectedCallback();
        window.addEventListener('keydown', this._onKeydown);
    }

    disconnectedCallback() {
        window.removeEventListener('keydown', this._onKeydown);
        super.disconnectedCallback();
    }

    willUpdate(changed) {
        if (changed.has('item') && this.item) {
            const item = this.item;

            this._orig = {
                content: item.content || '',
                description: item.description || '',
                due_string: item.due ? (item.due.string || item.due.date || '') : '',
                priority: String(item.priority || 1),
                labels: (item.labels || []).join(', '),
                section_id: item.section_id || '',
                due_date: item.due && item.due.date ? String(item.due.date).slice(0, 10) : '',
            };
            this._data = {...this._orig};
        }
    }

    close() {
        this.remove();
    }

    get _schema() {
        if (this.mode === 'todo') {
            return [
                {name: 'content', required: true, selector: {text: {}}},
                {name: 'description', selector: {text: {multiline: true}}},
                {name: 'due_date', selector: {date: {}}},
            ];
        }

        return [
            {name: 'content', required: true, selector: {text: {}}},
            {name: 'description', selector: {text: {multiline: true}}},
            {name: 'due_string', selector: {text: {}}},
            {
                name: 'priority',
                selector: {
                    select: {
                        mode: 'dropdown',
                        options: [
                            {value: '4', label: 'P1 (highest)'},
                            {value: '3', label: 'P2'},
                            {value: '2', label: 'P3'},
                            {value: '1', label: 'P4 (none)'},
                        ],
                    },
                },
            },
            ...(this.sections.length
                ? [{
                    name: 'section_id',
                    selector: {
                        select: {
                            mode: 'dropdown',
                            options: [
                                {value: '', label: 'No section'},
                                ...this.sections.map(section => ({value: section.id, label: section.name})),
                                {value: NEW_SECTION, label: '+ New section...'},
                            ],
                        },
                    },
                }]
                : [{
                    name: 'section_id',
                    selector: {
                        select: {
                            mode: 'dropdown',
                            options: [
                                {value: '', label: 'No section'},
                                {value: NEW_SECTION, label: '+ New section...'},
                            ],
                        },
                    },
                }]),
            ...(this._data && this._data.section_id === NEW_SECTION
                ? [{name: 'new_section_name', required: true, selector: {text: {}}}]
                : []),
            {name: 'labels', selector: {text: {}}},
        ];
    }

    _label(schema) {
        const labels = {
            content: 'Title',
            description: 'Description',
            due_date: 'Due date',
            due_string: this.readonly ? 'Date' : 'Date (e.g. "tomorrow", "every monday", empty = none)',
            priority: 'Priority',
            section_id: 'Section',
            new_section_name: 'Name of the new section',
            labels: 'Labels (comma separated)',
        };

        return labels[schema.name] || schema.name;
    }

    _valueChanged(e) {
        this._data = e.detail.value;
    }

    async _save() {
        const data = this._data;
        const orig = this._orig;

        if (!data.content || !data.content.trim()) {
            this._error = 'The title must not be empty.';
            return;
        }

        if (data.section_id === NEW_SECTION && !(data.new_section_name || '').trim()) {
            this._error = 'Please enter a name for the new section.';
            return;
        }

        const changes = {};
        if (data.content.trim() !== orig.content) {
            changes.content = data.content.trim();
        }
        if ((data.description || '') !== orig.description) {
            changes.description = data.description || '';
        }
        if (this.mode === 'todo') {
            if ((data.due_date || '') !== orig.due_date) {
                changes.due_date = data.due_date || '';
            }
        } else {
            if ((data.due_string || '').trim() !== orig.due_string) {
                changes.due_string = (data.due_string || '').trim();
            }
            if (String(data.priority) !== orig.priority) {
                changes.priority = Number(data.priority);
            }
            if ((data.labels || '') !== orig.labels) {
                changes.labels = (data.labels || '').split(',').map(label => label.trim()).filter(Boolean);
            }
            if ((data.section_id || '') !== orig.section_id) {
                changes.section_id = data.section_id || '';
                if (data.section_id === NEW_SECTION) {
                    changes.new_section_name = data.new_section_name.trim();
                }
            }
        }

        if (!Object.keys(changes).length) {
            this.close();
            return;
        }

        this._busy = true;
        this._error = '';

        try {
            await this.onSave(changes);
            this.close();
        } catch (err) {
            this._busy = false;
            this._error = (err && err.message) || String(err);
        }
    }

    async _complete() {
        this._busy = true;
        this._error = '';

        try {
            await this.onComplete();
            this.close();
        } catch (err) {
            this._busy = false;
            this._error = (err && err.message) || String(err);
        }
    }

    render() {
        if (!this.item || !this._data) {
            return html``;
        }

        return html`<div class="backdrop" @click=${(e) => e.target === e.currentTarget && this.close()}>
            <div class="dialog" role="dialog" aria-modal="true" aria-label="Edit task">
                <div class="title">
                    <span>${this.readonly ? 'Task details' : 'Edit task'}</span>
                    <button class="close" aria-label="Close" @click=${this.close}>&times;</button>
                </div>
                <ha-form
                    .hass=${this.hass}
                    .data=${this._data}
                    .schema=${this._schema}
                    .disabled=${this.readonly}
                    .computeLabel=${(schema) => this._label(schema)}
                    @value-changed=${this._valueChanged}
                ></ha-form>
                ${this._error ? html`<div class="error">${this._error}</div>` : html``}
                <div class="actions">
                    ${this.readonly
                        ? html`<span class="spacer"></span>
                            <button class="primary" @click=${this.close}>Close</button>`
                        : html`<button class="delete" ?disabled=${this._busy} @click=${() => this.onDelete()}>
                                Delete
                            </button>
                            <button class="complete" ?disabled=${this._busy} @click=${this._complete}>
                                Complete task
                            </button>
                            <span class="spacer"></span>
                            <button ?disabled=${this._busy} @click=${this.close}>Cancel</button>
                            <button class="primary" ?disabled=${this._busy} @click=${this._save}>Save</button>`}
                </div>
            </div>
        </div>`;
    }

    static get styles() {
        return css`
            :host {
                position: fixed;
                inset: 0;
                z-index: 9999;
            }

            .backdrop {
                position: absolute;
                inset: 0;
                display: flex;
                align-items: center;
                justify-content: center;
                background: rgba(0, 0, 0, 0.5);
            }

            .dialog {
                box-sizing: border-box;
                width: min(520px, calc(100vw - 32px));
                max-height: calc(100vh - 32px);
                overflow-y: auto;
                padding: 20px;
                border-radius: var(--ha-card-border-radius, 12px);
                background: var(--card-background-color, #1c1c1c);
                color: var(--primary-text-color, #fff);
                box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
                font-family: var(--paper-font-body1_-_font-family, inherit);
            }

            .title {
                display: flex;
                align-items: center;
                justify-content: space-between;
                margin-bottom: 16px;
                font-size: 20px;
                font-weight: 500;
            }

            button.close {
                padding: 0 8px;
                border: none;
                font-size: 28px;
                line-height: 1;
            }

            .error {
                margin-top: 12px;
                color: var(--error-color, #db4437);
            }

            .actions {
                display: flex;
                flex-wrap: wrap;
                align-items: center;
                gap: 8px;
                margin-top: 20px;
            }

            .spacer {
                flex: 1;
            }

            button {
                padding: 8px 16px;
                border: 1px solid var(--divider-color, #555);
                border-radius: 8px;
                background: transparent;
                color: var(--primary-text-color, #fff);
                font-size: 14px;
                cursor: pointer;
            }

            button.primary {
                border-color: var(--primary-color, #03a9f4);
                background: var(--primary-color, #03a9f4);
                color: var(--text-primary-color, #fff);
            }

            button.delete {
                border-color: var(--error-color, #db4437);
                color: var(--error-color, #db4437);
            }

            button.complete {
                border-color: var(--success-color, #43a047);
                color: var(--success-color, #43a047);
            }

            button:disabled {
                opacity: 0.5;
                cursor: default;
            }
        `;
    }
}


class TodoistCardConfirm extends LitElement {
    static get properties() {
        return {
            item: Object,
            onComplete: Object,
            onDelete: Object,
            onDone: Object,
            _step: String,
            _busy: Boolean,
            _error: String,
        };
    }

    constructor() {
        super();

        this._step = 'choose';
        this._busy = false;
        this._error = '';
        this._onKeydown = (e) => {
            if (e.key === 'Escape') {
                this.close();
            }
        };
    }

    connectedCallback() {
        super.connectedCallback();
        window.addEventListener('keydown', this._onKeydown);
    }

    disconnectedCallback() {
        window.removeEventListener('keydown', this._onKeydown);
        super.disconnectedCallback();
    }

    close() {
        this.remove();
    }

    async _run(action) {
        this._busy = true;
        this._error = '';

        try {
            await action();
            this.close();
            if (this.onDone) {
                this.onDone();
            }
        } catch (err) {
            this._busy = false;
            this._error = (err && err.message) || String(err);
        }
    }

    render() {
        if (!this.item) {
            return html``;
        }

        const confirming = this._step === 'confirm';

        return html`<div class="backdrop" @click=${(e) => e.target === e.currentTarget && this.close()}>
            <div class="dialog small" role="dialog" aria-modal="true">
                <div class="title">${confirming ? 'Really delete?' : 'Delete or complete?'}</div>
                <div class="text"><strong>${this.item.content}</strong></div>
                <div class="text">
                    ${confirming
                        ? 'The task will be deleted permanently. This cannot be undone.'
                        : 'Completing keeps the task in your Todoist history, deleting removes it.'}
                </div>
                ${this._error ? html`<div class="error">${this._error}</div>` : html``}
                <div class="actions">
                    ${confirming
                        ? html`<button ?disabled=${this._busy} @click=${() => { this._step = 'choose'; }}>Back</button>
                            <span class="spacer"></span>
                            <button class="delete" ?disabled=${this._busy} @click=${() => this._run(this.onDelete)}>
                                Yes, delete
                            </button>`
                        : html`<button ?disabled=${this._busy} @click=${this.close}>Cancel</button>
                            <span class="spacer"></span>
                            <button class="delete" ?disabled=${this._busy} @click=${() => { this._step = 'confirm'; }}>
                                Delete
                            </button>
                            <button class="primary" ?disabled=${this._busy} @click=${() => this._run(this.onComplete)}>
                                Complete
                            </button>`}
                </div>
            </div>
        </div>`;
    }

    static get styles() {
        return [
            TodoistCardDialog.styles,
            css`
                .dialog.small {
                    width: min(400px, calc(100vw - 32px));
                }

                .text {
                    margin: 8px 0;
                    word-break: break-word;
                }
            `,
        ];
    }
}


class TodoistCard extends LitElement {
    constructor() {
        super();

        this.itemsCompleted = [];
        this._todoItems = [];
        this._todoError = '';
        this._todoKey = undefined;
        this._todoFetching = false;
        this._todoRefetch = false;
        this.collapsed = new Set();
        this.collapsedLoaded = false;
    }

    get collapsedKey() {
        return 'todoist-card-collapsed-' + this.config.entity;
    }

    loadCollapsed() {
        this.collapsedLoaded = true;

        try {
            this.collapsed = new Set(JSON.parse(localStorage.getItem(this.collapsedKey)) || []);
        } catch (e) {
            this.collapsed = new Set();
        }
    }

    toggleSection(id) {
        if (this.collapsed.has(id)) {
            this.collapsed.delete(id);
        } else {
            this.collapsed.add(id);
        }

        try {
            localStorage.setItem(this.collapsedKey, JSON.stringify([...this.collapsed]));
        } catch (e) {
            // Persisting the state is optional.
        }

        this.requestUpdate();
    }

    static get properties() {
        return {
            hass: Object,
            config: Object,
            _statFilter: String,
        };
    }

    static getConfigElement() {
        return document.createElement('todoist-card-editor');
    }

    static getStubConfig(hass) {
        const states = (hass && hass.states) || {};
        const ids = Object.keys(states);
        // Prefer a REST sensor with tasks, otherwise fall back to the first todo entity.
        const entity = ids.find(id => id.startsWith('sensor.') && (states[id].attributes.items || states[id].attributes.tasks))
            || ids.find(id => id.startsWith('todo.'));

        return {entity: entity || ''};
    }

    // todo.* entities (official Todoist integration) work in basic mode, sensor.* entities need the REST setup.
    get isTodo() {
        return !!this.config && this.config.entity.startsWith('todo.');
    }

    // Changing tasks needs a todo entity or rest_command.todoist. Without it the card is view only,
    // whatever the options say.
    get canWrite() {
        return this.isTodo
            || !!(this.hass && this.hass.services.rest_command && this.hass.services.rest_command.todoist);
    }

    allow(option) {
        return this.canWrite && this.config[option] !== false;
    }

    todoCall(service, data) {
        return this.hass.callService('todo', service, data, {entity_id: this.config.entity});
    }

    async fetchTodo() {
        if (this._todoFetching) {
            this._todoRefetch = true;
            return;
        }

        this._todoFetching = true;

        try {
            const result = await this.hass.callWS({
                type: 'call_service',
                domain: 'todo',
                service: 'get_items',
                target: {entity_id: this.config.entity},
                service_data: {status: ['needs_action']},
                return_response: true,
            });
            const items = (result.response && result.response[this.config.entity]
                && result.response[this.config.entity].items) || [];

            this._todoItems = items.map(item => ({
                id: item.uid,
                content: item.summary,
                description: item.description || '',
                due: item.due ? {date: item.due} : null,
                section_id: null,
            }));
            this._todoError = '';
        } catch (e) {
            this._todoError = (e && e.message) || String(e);
        }

        this._todoFetching = false;
        this.requestUpdate();

        if (this._todoRefetch) {
            this._todoRefetch = false;
            this.fetchTodo();
        }
    }

    willUpdate() {
        if (this.hass && this.isTodo) {
            const state = this.hass.states[this.config.entity];
            const key = state ? state.state + '|' + (state.last_reported || state.last_updated) : '';

            if (key !== this._todoKey) {
                this._todoKey = key;
                this.fetchTodo();
            }
        }
    }

    async refresh() {
        await this.hass.callService('homeassistant', 'update_entity', {
            entity_id: this.config.entity,
        });

        if (this.isTodo) {
            await this.fetchTodo();
        }
    }

    // A hint that is shown above the list when something in the setup is missing.
    getNotice(state) {
        if (this.isTodo) {
            return this._todoError ? 'Could not load the tasks: ' + this._todoError : '';
        }

        if (!state.attributes.items && !state.attributes.tasks) {
            return 'The sensor has no tasks. Check json_attributes of the sensor (items or tasks) and the project ID, see the README. '
                + 'Without any setup you can also choose a todo entity of the Todoist integration.';
        }

        return '';
    }

    setConfig(config) {
        if (!config.entity) {
            throw new Error('Entity is not set!');
        }
        
        this.config = config;
    }

    getGridOptions() {
        return {columns: 12, min_columns: 6, rows: 'auto'};
    }

    getCardSize() {
        const state = this.hass && this.hass.states[this.config.entity];
        const items = this.isTodo ? this._todoItems : (state && (state.attributes.items || state.attributes.tasks));

        return (items && items.length) || 1;
    }
    
    random(min, max) {
        return Math.floor(Math.random() * (max - min) + min);
    }

    getUUID() {
        let date = new Date();
                    
        return this.random(1, 100) + '-' + (+date) + '-' + date.getMilliseconds();
    }
    
    itemAdd(e) {
        if (e.key === 'Enter') {
            let input = this.shadowRoot.getElementById('todoist-card-item-add');
            let value = input.value;
            
            if (value && value.length > 1) {
                if (this.isTodo) {
                    this.todoCall('add_item', {item: value}).then(() => {
                        input.value = '';

                        return this.refresh();
                    });

                    return;
                }

                let stateValue = this.hass.states[this.config.entity].state || undefined;
                
                if (stateValue) {
                    let uuid = this.getUUID();

                    if (!this.config.use_quick_add) {
                        let commands = [{
                            'type': 'item_add',
                            'temp_id': uuid,
                            'uuid': uuid,
                            'args': {
                                'project_id': stateValue,
                                'content': value,
                            },
                        }];

                        this.hass
                            .callService('rest_command', 'todoist', {
                                url: 'sync',
                                payload: 'commands=' + encodeURIComponent(JSON.stringify(commands)),
                            })
                            .then(response => {
                                input.value = '';

                                this.hass.callService('homeassistant', 'update_entity', {
                                    entity_id: this.config.entity,
                                });
                            });
                    } else {
                        let state = this.hass.states[this.config.entity] || undefined;
                        if (!state) {
                            return;
                        }
                        
                        this.hass
                            .callService('rest_command', 'todoist', {
                                url: 'tasks/quick',
                                payload: 'text=' + encodeURIComponent(value + ' #' + state.attributes.project.name.replaceAll(' ', '')),
                            })
                            .then(response => {
                                input.value = '';
    
                                this.hass.callService('homeassistant', 'update_entity', {
                                    entity_id: this.config.entity,
                                });
                            });
                    }
                }
            }
        }
    }
    
    markCompleted(item) {
        const max = this.config.show_completed ?? 5;

        if (this.itemsCompleted.length >= max) {
            this.itemsCompleted.splice(0, this.itemsCompleted.length - max + 1);
        }
        this.itemsCompleted.push(item);

        return this.refresh();
    }

    restCommand(type, item) {
        return this.hass.callService('rest_command', 'todoist', {
            url: 'sync',
            payload: 'commands=' + encodeURIComponent(JSON.stringify([{
                'type': type,
                'uuid': this.getUUID(),
                'args': {'id': item.id},
            }])),
        });
    }

    itemClose(item) {
        const done = this.isTodo
            ? this.todoCall('update_item', {item: item.id, status: 'completed'})
            : this.restCommand('item_close', item);

        return done.then(() => this.markCompleted(item));
    }

    itemUncomplete(item) {
        const done = this.isTodo
            ? this.todoCall('update_item', {item: item.id, status: 'needs_action'})
            : this.restCommand('item_uncomplete', item);

        return done.then(() => this.itemDeleteCompleted(item));
    }

    itemDelete(item) {
        const done = this.isTodo
            ? this.todoCall('remove_item', {item: item.id})
            : this.restCommand('item_delete', item);

        return done.then(() => this.refresh());
    }

    itemDeleteCompleted(item) {
        this.itemsCompleted = this.itemsCompleted.filter(v => {
            return v.id != item.id;
        });

        return this.refresh();
    }

    getSections(state) {
        return (state.attributes.sections || [])
            .filter(section => !section.is_deleted && !section.is_archived)
            .sort((a, b) => (a.section_order ?? a.order ?? 0) - (b.section_order ?? b.order ?? 0));
    }

    async sendCommands(commands) {
        if (!commands.length) {
            return;
        }

        const result = await this.hass.callService('rest_command', 'todoist', {
            url: 'sync',
            payload: 'commands=' + encodeURIComponent(JSON.stringify(commands)),
        }, undefined, true, true);

        // rest_command returns the HTTP response; the Sync API reports command errors in sync_status.
        const status = result && result.response && result.response.content
            && result.response.content.sync_status;
        if (status && typeof status === 'object') {
            const failed = Object.values(status).find(v => v !== 'ok');
            if (failed) {
                throw new Error((failed && failed.error) || 'Todoist rejected the change.');
            }
        }

        await this.refresh();
    }

    // Dialogs live inside the Home Assistant root like HA's own dialogs. Outside of it, HA components such as
    // the date picker do not get their locale and formats from the frontend context.
    mountDialog(dialog) {
        const root = document.querySelector('home-assistant');

        (root && root.shadowRoot ? root.shadowRoot : document.body).appendChild(dialog);
    }

    openEditor(item) {
        const state = this.hass.states[this.config.entity];
        const dialog = document.createElement('todoist-card-dialog');

        dialog.hass = this.hass;
        dialog.mode = this.isTodo ? 'todo' : 'rest';
        dialog.readonly = !this.canWrite;
        dialog.item = item;
        dialog.sections = this.getSections(state);
        dialog.onSave = (changes) => this.saveItem(item, state, changes);
        dialog.onComplete = () => this.itemClose(item);
        // Deleting from the edit dialog goes through the same two-step confirmation as the trash button.
        dialog.onDelete = () => this.confirmDelete(item, () => dialog.close());

        this.mountDialog(dialog);
    }

    confirmDelete(item, onDone) {
        const dialog = document.createElement('todoist-card-confirm');

        dialog.item = item;
        dialog.onDone = onDone;
        dialog.onComplete = () => this.itemClose(item);
        dialog.onDelete = () => this.itemDelete(item);

        this.mountDialog(dialog);
    }

    saveItem(item, state, changes) {
        if (this.isTodo) {
            const data = {item: item.id};

            if (changes.content !== undefined) {
                data.rename = changes.content;
            }
            if (changes.description !== undefined) {
                data.description = changes.description;
            }
            if (changes.due_date !== undefined) {
                data.due_date = changes.due_date || null;
            }

            return this.todoCall('update_item', data).then(() => this.refresh());
        }

        const commands = [];
        const update = {};

        ['content', 'description', 'priority', 'labels'].forEach(key => {
            if (changes[key] !== undefined) {
                update[key] = changes[key];
            }
        });
        if (changes.due_string !== undefined) {
            update.due = changes.due_string ? {string: changes.due_string} : null;
        }
        if (Object.keys(update).length) {
            commands.push({
                'type': 'item_update',
                'uuid': this.getUUID(),
                'args': {id: item.id, ...update},
            });
        }
        if (changes.section_id !== undefined) {
            let sectionId = changes.section_id;

            if (sectionId === NEW_SECTION) {
                sectionId = this.getUUID();
                commands.push({
                    'type': 'section_add',
                    'temp_id': sectionId,
                    'uuid': this.getUUID(),
                    'args': {name: changes.new_section_name, project_id: state.state},
                });
            }

            commands.push({
                'type': 'item_move',
                'uuid': this.getUUID(),
                'args': sectionId
                    ? {id: item.id, section_id: sectionId}
                    : {id: item.id, project_id: state.state},
            });
        }

        return this.sendCommands(commands);
    }

    renderItem(item) {
        return html`<div class="todoist-item">
                            ${this.allow('show_item_close')
                                ? html`<ha-icon-button
                                    class="todoist-item-close"
                                    @click=${() => this.itemClose(item)}
                                >
                                    <ha-icon icon="mdi:checkbox-marked-circle-outline"></ha-icon>
                                </ha-icon-button>`
                                : html`<ha-icon
                                    icon="mdi:circle-medium"
                                ></ha-icon>`}
                            <div
                                class="todoist-item-text ${this.config.mode === 'extended' ? 'todoist-item-clickable' : ''}"
                                @click=${() => this.config.mode === 'extended' && this.openEditor(item)}
                            >
                                ${item.description
                                    ? html`<span class="todoist-item-content">${item.content}</span>
                                           <span class="todoist-item-description">${item.description}</span>`
                                    : item.content}
                            </div>
                            ${this.allow('show_item_delete')
                                ? html`<ha-icon-button
                                    class="todoist-item-delete"
                                    @click=${() => this.confirmDelete(item)}
                                >
                                    <ha-icon icon="mdi:trash-can-outline"></ha-icon>
                                </ha-icon-button>`
                                : html``}
                        </div>`;
    }

    renderSection(group) {
        const collapsed = this.collapsed.has(group.section.id);
        const toggle = () => this.toggleSection(group.section.id);

        return html`<div
                class="todoist-section"
                role="button"
                tabindex="0"
                aria-expanded=${collapsed ? 'false' : 'true'}
                @click=${toggle}
                @keydown=${(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        toggle();
                    }
                }}
            >
                <ha-icon icon=${collapsed ? 'mdi:chevron-right' : 'mdi:chevron-down'}></ha-icon>
                <span class="todoist-section-name">${group.section.name}</span>
                <span class="todoist-section-count">${group.items.length}</span>
            </div>
            ${collapsed ? html`` : group.items.map(item => this.renderItem(item))}`;
    }

    // Counts over all open tasks, independent of the "today or overdue" filter.
    dueClass(item) {
        const pad = n => String(n).padStart(2, '0');
        const now = new Date();
        const today = now.getFullYear() + '-' + pad(now.getMonth() + 1) + '-' + pad(now.getDate());
        const day = item.due && item.due.date ? String(item.due.date).slice(0, 10) : '';

        if (!day) {
            return '';
        }

        return day < today ? 'overdue' : (day === today ? 'today' : '');
    }

    toggleStatFilter(name) {
        this._statFilter = this._statFilter === name ? undefined : name;
    }

    getStats(items) {
        let overdue = 0;
        let due = 0;

        items.forEach(item => {
            const kind = this.dueClass(item);
            if (kind === 'overdue') {
                overdue++;
            } else if (kind === 'today') {
                due++;
            }
        });

        return {
            open: items.length,
            overdue,
            today: due,
            completed: this.itemsCompleted ? this.itemsCompleted.length : 0,
        };
    }

    renderStats(stats) {
        const style = this.config.header_stats;

        if (style === 'chips') {
            return html`<div class="todoist-stats">
                ${stats.overdue
                    ? html`<span class="todoist-chip clickable overdue ${this._statFilter === 'overdue' ? 'active' : ''}" @click=${() => this.toggleStatFilter('overdue')}><ha-icon icon="mdi:alert-circle-outline"></ha-icon><b>${stats.overdue}</b> overdue</span>`
                    : html``}
                ${stats.today
                    ? html`<span class="todoist-chip clickable today ${this._statFilter === 'today' ? 'active' : ''}" @click=${() => this.toggleStatFilter('today')}><ha-icon icon="mdi:calendar-today"></ha-icon><b>${stats.today}</b> today</span>`
                    : html``}
                <span class="todoist-chip clickable ${this._statFilter ? '' : 'active'}" @click=${() => { this._statFilter = undefined; }}><ha-icon icon="mdi:format-list-checks"></ha-icon><b>${stats.open}</b> open</span>
                ${stats.completed
                    ? html`<span class="todoist-chip"><ha-icon icon="mdi:check"></ha-icon><b>${stats.completed}</b> completed</span>`
                    : html``}
            </div>`;
        }

        if (style === 'line') {
            const total = stats.open + stats.completed;
            const percent = total ? Math.round(stats.completed / total * 100) : 0;

            return html`<div class="todoist-stats-line">
                <div>
                    ${stats.open} open
                    ${stats.today ? html` · <span class="today clickable ${this._statFilter === 'today' ? 'active' : ''}" @click=${() => this.toggleStatFilter('today')}>${stats.today} today</span>` : html``}
                    ${stats.overdue ? html` · <span class="overdue clickable ${this._statFilter === 'overdue' ? 'active' : ''}" @click=${() => this.toggleStatFilter('overdue')}>${stats.overdue} overdue</span>` : html``}
                </div>
                ${stats.completed
                    ? html`<div class="todoist-progress"><div style="width: ${percent}%"></div></div>
                        <div class="todoist-progress-label">${stats.completed} of ${total} completed</div>`
                    : html``}
            </div>`;
        }

        return html``;
    }

    render() {
        if (!this.hass || !this.config) {
            return html``;
        }

        let state = this.hass.states[this.config.entity] || undefined;
        
        if (!state) {
            return html``;
        }
        
        // API v1 returns "tasks" instead of "items" in some endpoints.
        let items = this.isTodo ? this._todoItems : (state.attributes.items || state.attributes.tasks || []);
        const stats = this.getStats(items);
        if (this.config.only_today_overdue) {
            items = items.filter(item => {
                if (item.due && item.due.date) {
                    const date = /^\d{4}-\d{2}-\d{2}$/.test(item.due.date)
                        ? item.due.date + 'T00:00:00'
                        : item.due.date;

                    return (new Date()).setHours(23, 59, 59, 999) >= (new Date(date)).getTime();
                }

                return false;
            });
        }

        // Filter chosen by clicking a statistic. Only active while the statistics are shown.
        const statFilter = this.config.header_stats && this.config.header_stats !== 'none'
            && this.config.show_header !== false && stats[this._statFilter] ? this._statFilter : undefined;
        if (statFilter) {
            items = items.filter(item => this.dueClass(item) === statFilter);
        }

        if (!this.collapsedLoaded) {
            this.loadCollapsed();
        }

        const byOrder = (a, b) => (a.child_order ?? 0) - (b.child_order ?? 0);
        const showSections = this.config.show_sections !== false;
        const sections = showSections ? this.getSections(state) : [];
        const knownSections = new Set(sections.map(section => section.id));

        const rootItems = items.filter(item => !item.section_id || !knownSections.has(item.section_id)).sort(byOrder);
        const groups = sections
            .map(section => ({
                section,
                items: items.filter(item => item.section_id === section.id).sort(byOrder),
            }))
            // Empty sections are hidden only while the "today or overdue" filter is active.
            .filter(group => group.items.length || !this.config.only_today_overdue);

        const notice = this.getNotice(state);

        return html`<ha-card>
            ${(this.config.show_header === undefined) || (this.config.show_header !== false)
                ? html`<h1 class="card-header">
                    <div class="name">${state.attributes.friendly_name}</div>
                </h1>
                ${this.renderStats(stats)}`
                : html``}
            ${notice ? html`<div class="todoist-notice">${notice}</div>` : html``}
            <div class="todoist-list">
                ${items.length
                    ? html`${rootItems.map(item => this.renderItem(item))}
                        ${groups.map(group => this.renderSection(group))}`
                    : html`<div class="todoist-list-empty">No uncompleted tasks!</div>`}
                ${this.config.show_completed && this.itemsCompleted
                    ? this.itemsCompleted.map(item => {
                            return html`<div class="todoist-item todoist-item-completed">
                                ${this.allow('show_item_close')
                                    ? html`<ha-icon-button
                                        class="todoist-item-close"
                                        @click=${() => this.itemUncomplete(item)}
                                    >
                                        <ha-icon icon="mdi:plus-outline"></ha-icon>
                                    </ha-icon-button>`
                                    : html`<ha-icon
                                        icon="mdi:circle-medium"
                                    ></ha-icon>`}
                                <div class="todoist-item-text">
                                    ${item.description
                                        ? html`<span class="todoist-item-content">${item.content}</span>
                                            <span class="todoist-item-description">${item.description}</span>`
                                        : item.content}
                                </div>
                                ${this.allow('show_item_delete')
                                    ? html`<ha-icon-button
                                        class="todoist-item-delete"
                                        @click=${() => this.itemDeleteCompleted(item)}
                                    >
                                        <ha-icon icon="mdi:trash-can-outline"></ha-icon>
                                    </ha-icon-button>`
                                    : html``}
                            </div>`;
                        })
                    : html``}
            </div>
            ${this.allow('show_item_add')
                ? html`<input
                    id="todoist-card-item-add"
                    type="text"
                    class="todoist-item-add"
                    placeholder="New item..."
                    enterkeyhint="enter"
                    @keyup=${this.itemAdd}
                />`
                : html``}
        </ha-card>`;
    }
    
    static get styles() {
        return css`
            .card-header {
                padding-bottom: unset;
            }
            
            .todoist-list {
                display: flex;
                flex-direction: column;
                padding: 15px;
            }

            .todoist-stats {
                display: flex;
                flex-wrap: wrap;
                gap: 8px;
                padding: 8px 16px 0;
            }

            .todoist-chip {
                display: inline-flex;
                align-items: center;
                gap: 6px;
                padding: 3px 10px 3px 6px;
                border-radius: 999px;
                font-size: 13px;
                background: var(--secondary-background-color);
                color: var(--secondary-text-color);
            }

            .todoist-chip ha-icon {
                --mdc-icon-size: 16px;
            }

            .todoist-chip b {
                font-weight: 500;
                color: var(--primary-text-color);
            }

            .todoist-chip.overdue {
                background: color-mix(in srgb, var(--error-color, #db4437) 18%, transparent);
                color: var(--error-color, #db4437);
            }

            .todoist-chip.today {
                background: color-mix(in srgb, var(--warning-color, #ffa600) 18%, transparent);
                color: var(--warning-color, #ffa600);
            }

            .todoist-chip.overdue b, .todoist-chip.today b {
                color: inherit;
            }

            .clickable {
                cursor: pointer;
                user-select: none;
            }

            .todoist-chip.active {
                box-shadow: inset 0 0 0 1px currentColor;
            }

            .todoist-stats-line .clickable.active {
                text-decoration: underline;
            }

            .todoist-stats-line {
                padding: 4px 16px 0;
                font-size: 14px;
                color: var(--secondary-text-color);
            }

            .todoist-stats-line .today {
                color: var(--warning-color, #ffa600);
            }

            .todoist-stats-line .overdue {
                color: var(--error-color, #db4437);
            }

            .todoist-progress {
                height: 6px;
                margin-top: 8px;
                border-radius: 3px;
                background: var(--secondary-background-color);
                overflow: hidden;
            }

            .todoist-progress > div {
                height: 100%;
                background: var(--success-color, #43a047);
            }

            .todoist-progress-label {
                margin-top: 4px;
                font-size: 12px;
            }

            .todoist-list-empty {
                padding: 15px;
                text-align: center;
                font-size: 24px;
            }
            
            .todoist-item {
                display: flex;
                flex-direction: row;
                line-height: 48px;
            }

            .todoist-item-completed {
                color: #808080;
            }
            
            .todoist-item-text, .todoist-item-text > span {
                font-size: 16px;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }

            .todoist-item-clickable {
                cursor: pointer;
                flex: 1;
                min-width: 0;
            }

            .todoist-item-content {
                display: block;
                margin: -12px 0 -25px;
            }

            .todoist-item-description {
                display: block;
                opacity: 0.5;
                font-size: 12px !important;
                margin: -15px 0;
            }
            
            .todoist-item-close {
                color: #008000;
            }

            .todoist-item-completed .todoist-item-close {
                color: #808080;
            }
            
            .todoist-item-delete {
                margin-left: auto;
                color: #800000;
            }

            .todoist-item-completed .todoist-item-delete {
                color: #808080;
            }
            
            .todoist-notice {
                margin: 8px 15px 0;
                padding: 10px 14px;
                border-radius: 8px;
                border-left: 4px solid var(--warning-color, #ffa600);
                background: var(--secondary-background-color);
                font-size: 14px;
            }

            .todoist-section {
                display: flex;
                align-items: center;
                margin-top: 16px;
                padding: 4px 0;
                border-bottom: 1px solid var(--divider-color);
                cursor: pointer;
                user-select: none;
            }

            .todoist-section:focus-visible {
                outline: 2px solid var(--primary-color);
            }

            .todoist-section ha-icon {
                --mdc-icon-size: 20px;
                margin-right: 8px;
            }

            .todoist-section-name {
                font-weight: 600;
                font-size: 16px;
            }

            .todoist-section-count {
                margin-left: 8px;
                font-size: 14px;
                color: var(--secondary-text-color);
            }

            .todoist-item-add {
                width: calc(100% - 30px);
                height: 32px;
                margin: 0 15px 15px;
                padding: 10px;
                box-sizing: border-box;
                border-radius: 5px;
                font-size: 16px;
            }

            .todoist-item ha-icon-button ha-icon {
                margin-top: -10px;
            }
        `;
    }
}

customElements.define('todoist-card-editor', TodoistCardEditor);
customElements.define('todoist-card-dialog', TodoistCardDialog);
customElements.define('todoist-card-confirm', TodoistCardConfirm);
customElements.define('todoist-card', TodoistCard);

window.customCards = window.customCards || [];
window.customCards.push({
    preview: true,
    type: 'todoist-card',
    name: 'Todoist Card',
    description: 'Custom card for displaying lists from Todoist.',
});

console.info(
    '%c TODOIST-CARD ',
    'color: white; background: orchid; font-weight: 700',
);
