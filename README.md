> [!NOTE]
> This is a maintained fork of [grinstantin/todoist-card](https://github.com/grinstantin/todoist-card), which was discontinued.
> It has been migrated to the Todoist API v1, because the Sync API v9 and REST API v2 were shut down on 2026-02-10.
> **If you used the old configuration, see [Migrating from the original card](#migrating-from-the-original-card).**

# Todoist Card

[![HACS Custom](https://img.shields.io/badge/HACS-Custom-orange.svg)](https://hacs.xyz)
![License](https://img.shields.io/github/license/ConstableW/todoist-card)

Todoist card for [Home Assistant](https://www.home-assistant.io) Lovelace UI. This card displays items from selected Todoist project.

![Preview of todoist-card](https://user-images.githubusercontent.com/34913257/108243361-a8ea8500-7156-11eb-8313-a149a7cf38b8.png)

## Installing

### HACS

Add this fork as a custom repository in [HACS](https://hacs.xyz): *HACS → ⋮ → Custom repositories → `https://github.com/ConstableW/todoist-card` → type `Dashboard`*. Then install `Todoist Card`.

### Manual

1. Download [`todoist-card.js`](https://raw.githubusercontent.com/ConstableW/todoist-card/main/todoist-card.js).
2. Put `todoist-card.js` file into your `config/www` folder.
3. Add a reference to `todoist-card.js` in Lovelace. There's two way to do that:
   1. **Using UI:** _Configuration_ → _Lovelace Dashboards_ → _Resources_ → Click Plus button → Set _Url_ as `/local/todoist-card.js` → Set _Resource type_ as `JavaScript Module`.
   2. **Using YAML:** Add the following code to `lovelace` section.
      ```yaml
      resources:
        - url: /local/todoist-card.js
          type: module
      ```
4. Add `custom:todoist-card` to Lovelace UI as any other card (using either editor or YAML configuration).

## Using the card

This card can be configured using Lovelace UI editor.

1. Add the following code to `configuration.yaml`:
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
2. ... and to `secrets.yaml`:
    ```yaml
    todoist_api_token: 'Bearer TODOIST_API_TOKEN'
    ```
3. Replace `TODOIST_API_TOKEN` with your [token](https://app.todoist.com/app/settings/integrations/developer)

    > Important note! Replace only the `TODOIST_API_TOKEN` and keep the 'Bearer ' part unchanged.

    and `TODOIST_PROJECT_ID` with ID of your selected Todoist project.

    > `TODOIST_PROJECT_ID` is the ID at the end of the project URL (in API v1 it may be alphanumeric), which usually looks like this:
    `https://todoist.com/app/project/TODOIST_PROJECT_ID`
4. Reload configs or restart Home Assistant.
5. In Lovelace UI, click 3 dots in top left corner.
6. Click _Edit Dashboard_.
7. Click _Add Card_ button in the bottom right corner to add a new card.
8. Find _Custom: Todoist Card_ in the list.
9. Choose `entity`.
10. Now you should see the preview of the card!

Typical example of using this card in YAML config would look like this:

```yaml
type: 'custom:todoist-card'
entity: sensor.to_do_list
show_header: true
show_sections: true
show_completed: 5
show_item_add: true
use_quick_add: false
show_item_close: true
show_item_delete: true
only_today_overdue: false
```

Here is what every option means:

| Name                 |   Type    |   Default    | Description                                                                                                                      |
| -------------------- | :-------: | :----------: | -------------------------------------------------------------------------------------------------------------------------------- |
| `type`               | `string`  | **required** | `custom:todoist-card`                                                                                                            |
| `entity`             | `string`  | **required** | An entity_id within the `sensor` domain.                                                                                         |
| `show_completed`     | `integer` | `5`          | Number of completed tasks shown at the end of the list (0 to disable).                                                           |
| `show_header`        | `boolean` | `true`       | Show friendly name of the selected `sensor` in the card header.                                                                  |
| `show_sections`      | `boolean` | `true`       | Group tasks by Todoist sections. Sections are collapsible and show their task count (needs `sections` in `json_attributes`). |
| `show_item_add`      | `boolean` | `true`       | Show text input element for adding new items to the list.                                                                        |
| `use_quick_add`      | `boolean` | `false`      | Use the [Quick Add](https://todoist.com/help/articles/task-quick-add) implementation, available in the official Todoist clients. |
| `show_item_close`    | `boolean` | `true`       | Show `close/complete` and `uncomplete` buttons.                                                                                  |
| `show_item_delete`   | `boolean` | `true`       | Show `delete` buttons.                                                                                                           |
| `only_today_overdue` | `boolean` | `false`      | Only show tasks that are overdue or due today.                                                                                   |

> Note that the completed tasks list is cleared when the page is refreshed.

## Actions

- _Circle_ marks selected task as completed.
- _Plus_ "uncompletes" selected task, adding it back to the list.
- _Trash bin_ deletes selected task (gray one deletes it only from the list of completed items, not from Todoist archive).
- _Input_ adds new item to the list after pressing `Enter`.

## Migrating from the original card

Only the Home Assistant configuration changes, the card config stays the same:

| Before (`grinstantin/todoist-card`)                                | Now                                                         |
| ------------------------------------------------------------------ | ----------------------------------------------------------- |
| sensor `resource: .../sync/v9/projects/get_data` + `project_id` param | sensor `resource: .../api/v1/projects/TODOIST_PROJECT_ID/full` (no `params`) |
| `rest_command` url `.../sync/v9/{{ url }}`                          | `.../api/v1/{{ url }}`                                      |
| Quick Add via `quick/add`                                           | Quick Add via `tasks/quick`                                 |

Also add `tasks` and `sections` to the sensor's `json_attributes` (see above). Then reload the configuration or restart Home Assistant and refresh the browser (clear cache if the old card is still shown).

## Troubleshooting

- **Card is empty / "No uncompleted tasks!"**: open _Developer tools → States_, check the sensor and look at its attributes. It must contain `project` and `items` or `tasks`. Make sure the token in `secrets.yaml` starts with `Bearer ` and the project ID is correct.
- **Sensor is `unknown` or `unavailable`**: check the Home Assistant log for REST errors. HTTP 401/403 means a wrong token, 404/400 a wrong project ID.
- **Adding or completing tasks does nothing**: verify that the `rest_command.todoist` service exists (_Developer tools → Actions_) and was loaded after the restart.
- **Old version still shown**: reload the page with cache cleared (Ctrl+F5) or update the resource in _Settings → Dashboards → Resources_.

Please report problems in the [issue tracker](https://github.com/ConstableW/todoist-card/issues) and include the sensor's attributes.

## License

MIT © [Konstantin Grinkevich](https://github.com/grinstantin)
