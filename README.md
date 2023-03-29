# Yandex Cloud Worker Folder

> Если вам нужно на каждый PR создавать тестовый инстанс вашей инфраструктуры в Yandex Cloud, то этот Action для вас.

## Проблема

Новые директории в облаке создаются и удаляются крайне **медленно**. По этому создавать на каждый PR директорию, а потом удалять её не выгодно по времени выполнения CI/CD.

## Решение

Вы можете иметь несколько рабочих директорий. На каждый PR резервировать свободную, а после завершения PR освобождать её.

## Пример использования

### Резервирование директории

```yaml
on:
  pull_request:
    types: [opened]

jobs:
  create-pr-stand:
    runs-on: ubuntu-latest
    steps:
      - name: allocate folder
        id: folder
        uses: soprachevak/yandex-cloud-worker-folder@v1
        with:
          operation: get
          cloudId: ${{ secrets.YC_CLOUD_ID }}
          oauthToken: ${{ secrets.YC_TOKEN }}

      - name: deploy
        run: echo "FOLDER_ID=${{ steps.folder.outputs.folderId }}"

        ...
```

### Освобождение директории

```yaml
on:
  pull_request:
    types: [closed]

jobs:
  delete-pr-stand:
    runs-on: ubuntu-latest
    steps:
      - name: free folder
        id: folder
        uses: soprachevak/yandex-cloud-worker-folder@v1
        with:
          operation: free
          cloudId: ${{ secrets.YC_CLOUD_ID }}
          oauthToken: ${{ secrets.YC_TOKEN }}
```

## Параметры

| Название        | Обязательный | get | free | Описание                                                                                                                                       |
| --------------- | ------------ | --- | ---- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| operation       | +            | +   | +    | Операция: `get` или `free`                                                                                                                     |
| cloudId         | +            | +   | +    | ID облака                                                                                                                                      |
| oauthToken      | +            | +   | +    | OAuth-токен                                                                                                                                    |
| allowChangeName |              | +   | +    | Разрешить изменять имя директории, по умолчанию `true`. При резервирование будет `worker-node-{name}`                                          |
| key             |              | +   | +    | Ключ для поиска директории, по умолчанию `owner/repo-prNumber`                                                                                 |
| allowAllocate   |              | +   |      | Разрешает резервировать новую директорию при `get` операции. Если по `key` ничего не найдено, будет зарезервирована новая. По умолчанию `true` |
| name            |              | +   |      | Имя директории после резервирования, если не создаёт конфликтов                                                                                |
| folderId        |              |     | +    | ID директории для освобождения, по умолчанию берётся по ключу `key`                                                                            |

## Как это работает

Этот Action имеет два режима работы:

- get - отдаёт зарезервированную или резервирует рабочую директорию
- free - освобождает рабочую директорию

Состояние директории хранится в `labels` директории в Yandex Cloud. Если при резервирование директории не найдено свободной, то создаётся новая.

Имя рабочих директорий формируется по шаблону: `worker-folder-ID`. Состояние отображается в описание директории `[working]` или `[free]`. Когда вы резервируете директорию, вы можете указать имя директории, которое будет использоваться вместо `ID`, например `worker-folder-PR-123`.
