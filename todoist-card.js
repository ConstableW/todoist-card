import {LitElement, html, css} from 'https://cdn.jsdelivr.net/npm/lit@3.2.1/+esm';

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

    get _schema() {
        return [
            {name: 'entity', required: true, selector: {entity: {domain: 'sensor'}}},
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
            {name: 'show_sections', selector: {boolean: {}}},
            {name: 'show_item_add', selector: {boolean: {}}},
            {name: 'use_quick_add', selector: {boolean: {}}},
            {name: 'show_item_close', selector: {boolean: {}}},
            {name: 'show_item_delete', selector: {boolean: {}}},
            {name: 'only_today_overdue', selector: {boolean: {}}},
        ];
    }

    get _data() {
        return {
            mode: 'quick',
            show_completed: 5,
            show_header: true,
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

        return html`<ha-form
            .hass=${this.hass}
            .data=${this._data}
            .schema=${this._schema}
            .computeLabel=${(schema) => this._label(schema)}
            @value-changed=${this._valueChanged}
        ></ha-form>`;
    }
}


class TodoistCardDialog extends LitElement {
    static get properties() {
        return {
            hass: Object,
            item: Object,
            sections: Array,
            onSave: Object,
            onDelete: Object,
            _data: Object,
            _busy: Boolean,
            _error: String,
            _confirmDelete: Boolean,
        };
    }

    constructor() {
        super();

        this.sections = [];
        this._busy = false;
        this._error = '';
        this._confirmDelete = false;
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
            };
            this._data = {...this._orig};
        }
    }

    close() {
        this.remove();
    }

    get _schema() {
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
                            ],
                        },
                    },
                }]
                : []),
            {name: 'labels', selector: {text: {}}},
        ];
    }

    _label(schema) {
        const labels = {
            content: 'Title',
            description: 'Description',
            due_string: 'Date (e.g. "tomorrow", "every monday", empty = none)',
            priority: 'Priority',
            section_id: 'Section',
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

        const changes = {};
        if (data.content.trim() !== orig.content) {
            changes.content = data.content.trim();
        }
        if ((data.description || '') !== orig.description) {
            changes.description = data.description || '';
        }
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

    async _delete() {
        if (!this._confirmDelete) {
            this._confirmDelete = true;
            return;
        }

        this._busy = true;

        try {
            await this.onDelete();
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
                <div class="title">Edit task</div>
                <ha-form
                    .hass=${this.hass}
                    .data=${this._data}
                    .schema=${this._schema}
                    .computeLabel=${(schema) => this._label(schema)}
                    @value-changed=${this._valueChanged}
                ></ha-form>
                ${this._error ? html`<div class="error">${this._error}</div>` : html``}
                <div class="actions">
                    <button class="delete" ?disabled=${this._busy} @click=${this._delete}>
                        ${this._confirmDelete ? 'Really delete?' : 'Delete'}
                    </button>
                    <span class="spacer"></span>
                    <button ?disabled=${this._busy} @click=${this.close}>Cancel</button>
                    <button class="primary" ?disabled=${this._busy} @click=${this._save}>Save</button>
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
                margin-bottom: 16px;
                font-size: 20px;
                font-weight: 500;
            }

            .error {
                margin-top: 12px;
                color: var(--error-color, #db4437);
            }

            .actions {
                display: flex;
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

            button:disabled {
                opacity: 0.5;
                cursor: default;
            }
        `;
    }
}


class TodoistCard extends LitElement {
    constructor() {
        super();

        this.itemsCompleted = [];
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
        };
    }
    
    static getConfigElement() {
        return document.createElement('todoist-card-editor');
    }

    static getStubConfig(hass) {
        const entity = Object.keys((hass && hass.states) || {}).find(id => id.startsWith('sensor.'));

        return {entity: entity || ''};
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
        const items = state && (state.attributes.items || state.attributes.tasks);

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
    
    itemClose(item) {
        let commands = [{
            'type': 'item_close',
            'uuid': this.getUUID(),
            'args': {
                'id': item.id,
            },
        }];
        
        this.hass
            .callService('rest_command', 'todoist', {
                url: 'sync',
                payload: 'commands=' + encodeURIComponent(JSON.stringify(commands)),
            })
            .then(response => {
                if (this.itemsCompleted.length >= this.config.show_completed) {
                    this.itemsCompleted.splice(0, this.itemsCompleted.length - this.config.show_completed + 1);
                }
                this.itemsCompleted.push(item);

                this.hass.callService('homeassistant', 'update_entity', {
                    entity_id: this.config.entity,
                });
            });
    }

    itemUncomplete(item) {
        let commands = [{
            'type': 'item_uncomplete',
            'uuid': this.getUUID(),
            'args': {
                'id': item.id,
            },
        }];
        
        this.hass
            .callService('rest_command', 'todoist', {
                url: 'sync',
                payload: 'commands=' + encodeURIComponent(JSON.stringify(commands)),
            })
            .then(response => {
                this.itemDeleteCompleted(item);

                // this.hass.callService('homeassistant', 'update_entity', {
                //     entity_id: this.config.entity,
                // });
            });
    }
    
    itemDelete(item) {
        let commands = [{
            'type': 'item_delete',
            'uuid': this.getUUID(),
            'args': {
                'id': item.id,
            },
        }];
        
        this.hass
            .callService('rest_command', 'todoist', {
                url: 'sync',
                payload: 'commands=' + encodeURIComponent(JSON.stringify(commands)),
            })
            .then(response => {
                this.hass.callService('homeassistant', 'update_entity', {
                    entity_id: this.config.entity,
                });
            });
    }

    itemDeleteCompleted(item) {
        this.itemsCompleted = this.itemsCompleted.filter(v => {
            return v.id != item.id;
        });

        this.hass.callService('homeassistant', 'update_entity', {
            entity_id: this.config.entity,
        });
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

        await this.hass.callService('homeassistant', 'update_entity', {
            entity_id: this.config.entity,
        });
    }

    openEditor(item) {
        const state = this.hass.states[this.config.entity];
        const dialog = document.createElement('todoist-card-dialog');

        dialog.hass = this.hass;
        dialog.item = item;
        dialog.sections = this.getSections(state);
        dialog.onSave = (changes) => this.saveItem(item, state, changes);
        dialog.onDelete = () => this.sendCommands([{
            'type': 'item_delete',
            'uuid': this.getUUID(),
            'args': {'id': item.id},
        }]);

        document.body.appendChild(dialog);
    }

    saveItem(item, state, changes) {
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
            commands.push({
                'type': 'item_move',
                'uuid': this.getUUID(),
                'args': changes.section_id
                    ? {id: item.id, section_id: changes.section_id}
                    : {id: item.id, project_id: state.state},
            });
        }

        return this.sendCommands(commands);
    }

    renderItem(item) {
        return html`<div class="todoist-item">
                            ${(this.config.show_item_close === undefined) || (this.config.show_item_close !== false)
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
                            ${(this.config.show_item_delete === undefined) || (this.config.show_item_delete !== false)
                                ? html`<ha-icon-button
                                    class="todoist-item-delete"
                                    @click=${() => this.itemDelete(item)}
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

    render() {
        if (!this.hass || !this.config) {
            return html``;
        }

        let state = this.hass.states[this.config.entity] || undefined;
        
        if (!state) {
            return html``;
        }
        
        // API v1 returns "tasks" instead of "items" in some endpoints.
        let items = state.attributes.items || state.attributes.tasks || [];
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

        return html`<ha-card>
            ${(this.config.show_header === undefined) || (this.config.show_header !== false)
                ? html`<h1 class="card-header">
                    <div class="name">${state.attributes.friendly_name}</div>
                </h1>`
                : html``}
            <div class="todoist-list">
                ${items.length
                    ? html`${rootItems.map(item => this.renderItem(item))}
                        ${groups.map(group => this.renderSection(group))}`
                    : html`<div class="todoist-list-empty">No uncompleted tasks!</div>`}
                ${this.config.show_completed && this.itemsCompleted
                    ? this.itemsCompleted.map(item => {
                            return html`<div class="todoist-item todoist-item-completed">
                                ${(this.config.show_item_close === undefined) || (this.config.show_item_close !== false)
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
                                ${(this.config.show_item_delete === undefined) || (this.config.show_item_delete !== false)
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
            ${(this.config.show_item_add === undefined) || (this.config.show_item_add !== false)
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
