# Yandex Cloud Worker Folder

> Если вам нужно на каждый PR создавать тестовый инстанс вашей инфраструктуры в Yandex Cloud, то этот Action для вас.

## Проблема

Новые директории в облаке создаются и удаляются крайне **медленно**. По этому создавать на каждый PR директорию, а потом удалять её не выгодно по времени выполнения CI/CD.

## Решение

Вы можете иметь несколько рабочих директорий. На каждый PR резервировать свободную, а после завершения PR освобождать её.

## Как это работает

Этот Action имеет два режима работы:

- allocate - резервирует рабочую директорию
- free - освобождает рабочую директорию

Состояние директории хранится в `labels` директории в Yandex Cloud. Если при резервирование директории не найдено свободной, то создаётся новая.

Имя рабочих директорий формируется по шаблону: `worker-folder-ID`. Состояние отображается в описание директории `[working]` или `[free]`. Когда вы резервируете директорию, вы можете указать имя директории, которое будет использоваться вместо `ID`, например `worker-folder-PR-123`.

## Пример использования

### Резервирование директории

```yaml
name: CI

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
          operation: allocate
          cloudId: ${{ secrets.YC_CLOUD_ID }}
          oauthToken: ${{ secrets.YC_TOKEN }}
          folderName: PR-${{ github.event.number }}

      - name: deploy
        run: echo "FOLDER_ID=${{ steps.folder.outputs.folderId }}"

        ...
```

### Освобождение директории

```yaml
name: CI

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
          folderName: PR-${{ github.event.number }}
```
