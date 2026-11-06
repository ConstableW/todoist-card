# Todoist Card

[![HACS Custom](https://img.shields.io/badge/HACS-Custom-orange.svg)](https://hacs.xyz)
![License](https://img.shields.io/github/license/ConstableW/todoist-card)

A [Home Assistant](https://www.home-assistant.io) Lovelace card that shows the tasks of a Todoist project, grouped by section, and lets you complete, add, edit and delete them.

> [!NOTE]
> This is a maintained fork of [grinstantin/todoist-card](https://github.com/grinstantin/todoist-card), which was discontinued.
> It uses the **Todoist API v1**, because the Sync API v9 and REST API v2 used by the original card were shut down on 2026-02-10.
> If you used the original card, see [Migrating from the original card](#migrating-from-the-original-card).

<p align="center">
  <img src="docs/images/list.png" alt="Task list grouped by collapsible sections" width="320">
  <img src="docs/images/edit-dialog.png" alt="Edit dialog" width="320">
</p>

## Features

- Shows the tasks of one Todoist project, including descriptions.
- **Sections:** tasks are grouped by Todoist section. Sections are collapsible, show their number of tasks and remember their state.
- **Complete** tasks with one click, **undo** completed tasks (list of recently completed tasks).
- **Add** tasks, optionally with Todoist's [Quick Add](https://todoist.com/help/articles/task-quick-add) syntax.
- **Extended mode:** click a task to edit title, description, date, priority, section and labels, create a new section, complete or delete the task.
- Safe deletion: deleting always asks whether you want to complete the task instead and needs a second confirmation.
- Filter for tasks that are due today or overdue.
- Visual editor for the card configuration, works with sections view and masonry view.

## Requirements

- Home Assistant with the UI-based dashboards (Lovelace). Developed against the current frontend (custom card using `ha-form`, `ha-card`, `ha-icon`, `ha-icon-button`).
- A Todoist account and a [personal API token](https://app.todoist.com/app/settings/integrations/developer).
- The browser needs internet access to `cdn.jsdelivr.net`, because the card loads the [Lit](https://lit.dev) library from there.

## Installation

### HACS (custom repository)

1. Open HACS in Home Assistant.
2. Click the three dots in the top right corner and choose **Custom repositories**.
3. Enter `https://github.com/ConstableW/todoist-card` and choose the type **Dashboard** (called _Lovelace_ in older HACS versions).
4. Search for **Todoist Card** in HACS and install it.
5. Reload the browser page (Ctrl+F5). HACS adds the resource automatically.

### Manual

1. Download [`todoist-card.js`](https://raw.githubusercontent.com/ConstableW/todoist-card/main/todoist-card.js).
2. Put the file into the `config/www` folder of Home Assistant.
3. Add it as a resource, either
   - **via UI:** _Settings_ → _Dashboards_ → ⋮ → _Resources_ → _Add resource_ → URL `/local/todoist-card.js`, type `JavaScript Module` (enable _Advanced mode_ in your user profile if you do not see _Resources_), or
   - **via YAML:**
     ```yaml
     lovelace:
       resources:
         - url: /local/todoist-card.js
           type: module
     ```

### Without HACS and without copying files

You can also reference the file directly from GitHub through jsDelivr. Add a resource of type `JavaScript Module` with this URL:

```
https://cdn.jsdelivr.net/gh/ConstableW/todoist-card@COMMIT/todoist-card.js
```

Replace `COMMIT` with the short hash of the [latest commit](https://github.com/ConstableW/todoist-card/commits/main). Do not use `@main`: jsDelivr caches branches for up to 12 hours and ignores `?v=` query strings, so you would not see updates. Do not use `raw.githubusercontent.com` either, it serves the wrong MIME type and the browser refuses to load it as a module.

## Setup

The card talks to Todoist through two things in your Home Assistant configuration: a REST **sensor** that reads the project, and a **`rest_command`** that sends changes.

### 1. Home Assistant configuration

Add this to `configuration.yaml`:

```yaml
sensor:
  - platform: rest
    name: To-do List
    method: GET
    resource: 'https://api.todoist.com/api/v1/projects/TODOIST_PROJECT_ID/full'
    headers:
      Authorization: !secret todoist_api_token
    value_template: '{{ value_json[''project''][''id''] }}'
    json_attributes:
      - project
      - items
      - tasks
      - sections
    scan_interval: 30

rest_command:
  todoist:
    method: post
    url: 'https://api.todoist.com/api/v1/{{ url }}'
    payload: '{{ payload }}'
    headers:
      Authorization: !secret todoist_api_token
    content_type: 'application/x-www-form-urlencoded'
```

and to `secrets.yaml`:

```yaml
todoist_api_token: 'Bearer TODOIST_API_TOKEN'
```

Replace

- `TODOIST_API_TOKEN` with your [token](https://app.todoist.com/app/settings/integrations/developer). Keep the `Bearer ` part unchanged.
- `TODOIST_PROJECT_ID` with the ID of your project. You find it at the end of the project URL: `https://app.todoist.com/app/project/TODOIST_PROJECT_ID` (in API v1 it may contain letters).

Then reload the configuration or restart Home Assistant.

> **Why `items`, `tasks` and `sections`?** The card reads the tasks from `items` or, if that is missing, from `tasks`. `sections` is needed for the section grouping and for moving tasks between sections. Attributes that Todoist does not return are simply ignored.

### 2. Add the card

1. Open a dashboard, click the pencil icon (_Edit dashboard_) and then _Add card_.
2. Choose **Custom: Todoist Card**.
3. Select the sensor you created (`sensor.to_do_list`).

Or use YAML:

```yaml
type: custom:todoist-card
entity: sensor.to_do_list
mode: extended
show_header: true
show_sections: true
show_completed: 5
show_item_add: true
use_quick_add: false
show_item_close: true
show_item_delete: true
only_today_overdue: false
```

## Options

| Name                 |   Type    |   Default    | Description                                                                                                                                  |
| -------------------- | :-------: | :----------: | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `type`               | `string`  | **required** | `custom:todoist-card`                                                                                                                        |
| `entity`             | `string`  | **required** | The sensor from the setup above (an entity in the `sensor` domain).                                                                          |
| `mode`               | `string`  | `quick`      | `quick`: complete and delete only. `extended`: clicking a task opens the [edit dialog](#extended-mode).                                      |
| `show_header`        | `boolean` | `true`       | Show the friendly name of the sensor as card header.                                                                                         |
| `show_sections`      | `boolean` | `true`       | Group tasks by Todoist section. Needs `sections` in the sensor's `json_attributes`.                                                          |
| `show_completed`     | `integer` | `5`          | Number of completed tasks shown at the end of the list (0 to disable).                                                                       |
| `show_item_add`      | `boolean` | `true`       | Show the text input for adding new tasks.                                                                                                    |
| `use_quick_add`      | `boolean` | `false`      | Add tasks with Todoist [Quick Add](https://todoist.com/help/articles/task-quick-add) (understands dates, labels, priorities in the text).    |
| `show_item_close`    | `boolean` | `true`       | Show the _complete_ and _uncomplete_ buttons.                                                                                                |
| `show_item_delete`   | `boolean` | `true`       | Show the _delete_ buttons.                                                                                                                   |
| `only_today_overdue` | `boolean` | `false`      | Only show tasks that are due today or overdue. Empty sections are hidden while this is active.                                               |

All options can also be set in the visual editor of the card.

## Usage

### Sections

Tasks that belong to a Todoist section are shown below a section header with an arrow and the number of tasks. Click the header to collapse or expand the section. The state is stored per sensor in the browser (`localStorage`), so it can differ between devices. Tasks without a section are shown first, without a header.

Switch it off with `show_sections: false` to get one flat list.

### Actions

- **Circle:** completes the task.
- **Plus** (in the list of completed tasks): "uncompletes" the task and adds it back to the list.
- **Trash bin:** asks whether you want to **complete** or **delete** the task. Deleting needs a second confirmation. The gray trash bin in the list of completed tasks only removes the entry from that list, not from Todoist.
- **Input field:** adds a new task after pressing `Enter`. New tasks are created at the top level of the project (not inside a section).

<p align="center">
  <img src="docs/images/delete-confirm.png" alt="Delete or complete prompt in front of the edit dialog" width="320">
</p>

> The list of completed tasks is kept in the browser page and is cleared when the page is reloaded.

### Extended mode

With `mode: extended` a click on the text of a task opens an edit dialog. The circle still completes the task directly.

| Field       | Notes                                                                                                                                                                |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Title       | Required.                                                                                                                                                            |
| Description | Optional, multi-line.                                                                                                                                                |
| Date        | Free text that Todoist parses itself, e.g. `tomorrow`, `every monday` or `15 dec`. Empty removes the date. Recurring tasks keep their rule as long as you do not change this field. |
| Priority    | P1 (highest) to P4 (none).                                                                                                                                           |
| Section     | Moves the task to another section. _No section_ moves it to the top level of the project, _+ New section..._ creates a section with the name you enter and moves the task into it. |
| Labels      | Comma separated.                                                                                                                                                     |

Buttons: **Save** (only sends what you changed), **Cancel** or the × in the corner, **Complete task**, and **Delete** (with the same two-step confirmation as the trash bin). Errors reported by Todoist are shown in the dialog.

Not supported: deadlines, reminders, locations, comments, sub-task hierarchy, and picking a section when adding a new task.

## Migrating from the original card

Only the Home Assistant configuration changes, the card options stay the same.

| Before (`grinstantin/todoist-card`)                                      | Now                                                                          |
| ------------------------------------------------------------------------ | ---------------------------------------------------------------------------- |
| sensor `resource: .../sync/v9/projects/get_data` with a `project_id` param | sensor `resource: .../api/v1/projects/TODOIST_PROJECT_ID/full`, no `params`  |
| `rest_command` url `.../sync/v9/{{ url }}`                                | `.../api/v1/{{ url }}`                                                       |
| Quick Add via `quick/add`                                                 | Quick Add via `tasks/quick` (handled by the card)                            |
| `json_attributes: project, items`                                         | `json_attributes: project, items, tasks, sections`                           |

Then:

1. Replace the card resource (HACS: remove the old repository, add this one).
2. Reload the configuration or restart Home Assistant.
3. Reload the browser with the cache cleared (Ctrl+F5; in the companion app: _Settings → Companion app → Troubleshooting → Reset frontend cache_).

## Troubleshooting

- **The card is empty or shows "No uncompleted tasks!"**
  Open _Developer tools → States_ and look at the sensor. Its attributes must contain `project` and `items` or `tasks`. Check that the token in `secrets.yaml` starts with `Bearer ` and that the project ID is correct.
- **The sensor is `unknown` or `unavailable`**
  Check the Home Assistant log for REST errors. HTTP 401/403 means a wrong token, 400/404 a wrong project ID.
- **No sections are shown**
  `sections` is missing in `json_attributes` or `show_sections` is `false`. Check the sensor attributes for a `sections` list.
- **Adding, completing or editing does nothing**
  Check that the action `rest_command.todoist` exists (_Developer tools → Actions_) and that you restarted Home Assistant after adding it. Errors from Todoist are shown in the edit dialog; for other actions check the log.
- **Log message "State attributes ... exceed maximum size of 16384 bytes"**
  Large projects produce big attributes. The card still works, only the database does not store the attributes. You can exclude the sensor from the [recorder](https://www.home-assistant.io/integrations/recorder/#configure-filter) to silence it.
- **A change shows up late**
  The card refreshes the sensor after each action, but Todoist may need a moment. The sensor is polled every `scan_interval` seconds.
- **The old version is still shown**
  Reload with the cache cleared (Ctrl+F5). With jsDelivr, use a commit hash in the URL instead of `@main`.
- **The editor of the card looks broken**
  Make sure you run the current version of the card and clear the browser cache.

Please report problems in the [issue tracker](https://github.com/ConstableW/todoist-card/issues) and include the attributes of your sensor (without private task names, if you like).

## Development

The card is a single file, [`todoist-card.js`](todoist-card.js), without a build step. It is a native ES module and loads Lit from jsDelivr. To try changes, copy the file to `config/www`, add it as a resource as described above and reload the browser. The repository is validated with the HACS action on every push.

## Credits and license

Original card by [Konstantin Grinkevich](https://github.com/grinstantin), maintained by [ConstableW](https://github.com/ConstableW) as a fork. Not affiliated with Doist or Todoist.

MIT, see [LICENSE](LICENSE).
