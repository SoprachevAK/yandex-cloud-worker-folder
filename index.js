import core from '@actions/core'
import github from '@actions/github'
import { Session, cloudApi, serviceClients } from '@yandex-cloud/nodejs-sdk'
import md5 from 'md5'

const WORKER_NODE_TAG = 'worker-node'
const WORKER_NODE_ID_TAG = 'worker-node-id'
const WORKER_KEY_TAG = 'worker-node-key'

const {
  resourcemanager: {
    folder_service: { ListFoldersRequest, CreateFolderRequest, UpdateFolderRequest, GetFolderRequest, CreateFolderMetadata },
    folder: { Folder_Status },
  },
} = cloudApi


try {
  const operation = core.getInput('operation', { required: true })
  const cloudId = core.getInput('cloudId', { required: true })
  const oauthToken = core.getInput('oauthToken', { required: true })
  const allowNameChange = core.getInput('allowChangeName') ?? true
  const freeFolderId = core.getInput('folderId') ?? ''
  const targetName = core.getInput('name') ?? ''

  const folderService = new Session({ oauthToken }).client(serviceClients.FolderServiceClient)
  const folders = await folderService.list(ListFoldersRequest.fromPartial({ cloudId }))
  const folderNames = folders.folders.map(folder => folder.name)

  async function getWorker(allowAllocate, key) {
    const workers = folders.folders.filter(folder =>
      folder.labels[WORKER_NODE_TAG] &&
      folder.labels[WORKER_NODE_ID_TAG] &&
      folder.status == Folder_Status.ACTIVE)

    console.log(`Use key: ${key}`)
    const hashKey = md5(tag)

    const workerByKey = workers.find(folder => folder.labels[WORKER_KEY_TAG] == hashKey)
    if (workerByKey) {
      console.log(`Found worker by key: ${workerByKey.id}`)
      return workerByKey.id
    }

    if (allowAllocate == false) {
      throw new Error(`No free workers found. Allocate new worker is not allowed`)
    }

    const freeWorkers = workers.filter(folder => folder.labels[WORKER_NODE_TAG] == 'free')
    const workerIds = workers.map(folder => folder.labels[WORKER_NODE_ID_TAG])

    const workName = `worker-folder-${targetName}`

    if (freeWorkers.length == 0) {
      console.log(`Found ${freeWorkers.length} free workers. Total workers: ${workers.length}. Allocate new worker...`);
      const id = makeidUnique(4, workerIds)

      const folder = await folderService.create(CreateFolderRequest.fromPartial({
        cloudId: cloudId,
        name: !folderNames.includes(workName) ? workName : `worker-folder-${id}`,
        description: `[working] CICD worker folder ${id}`,
        labels: {
          [WORKER_NODE_TAG]: 'working',
          [WORKER_NODE_ID_TAG]: id,
          [WORKER_KEY_TAG]: hashKey
        }
      }))

      return CreateFolderMetadata.decode(folder.metadata.value).folderId
    }

    console.log(`Found ${freeWorkers.length} free workers. Total workers: ${workers.length}. Use first free worker...`);
    const worker = freeWorkers[0]
    await folderService.update(UpdateFolderRequest.fromPartial({
      folderId: worker.id,
      name: allowNameChange && !folderNames.includes(workName) ? workName : worker.name,
      description: allowNameChange ? `[working] CICD worker folder ${worker.labels[WORKER_NODE_ID_TAG]}` : worker.description,
      labels: {
        [WORKER_NODE_TAG]: 'working',
        [WORKER_NODE_ID_TAG]: worker.labels[WORKER_NODE_ID_TAG],
        [WORKER_KEY_TAG]: hashKey
      }
    }))

    return worker.id
  }

  async function freeWorker(folderId) {
    const folderService = new Session({ oauthToken }).client(serviceClients.FolderServiceClient)
    const folder = await folderService.get(GetFolderRequest.fromPartial({ folderId }))

    const id = folder.labels[WORKER_NODE_ID_TAG]
    const name = `worker-folder-${id}`
    await folderService.update(UpdateFolderRequest.fromPartial({
      folderId,
      name: allowNameChange && !folderNames.includes(name) ? name : folder.name,
      description: allowNameChange ? `[free] CICD worker folder ${id}` : folder.description,
      labels: {
        [WORKER_NODE_TAG]: 'free',
        [WORKER_NODE_ID_TAG]: folder.labels[WORKER_NODE_ID_TAG]
      }
    }))

    return folderId
  }

  async function freeWorkerByKey(key) {
    const workers = folders.folders.filter(folder =>
      folder.labels[WORKER_NODE_TAG] &&
      folder.labels[WORKER_NODE_ID_TAG] &&
      folder.status == Folder_Status.ACTIVE)

    console.log(`Use key: ${key}`)
    const hashKey = md5(tag)

    const workerByKey = workers.find(folder => folder.labels[WORKER_KEY_TAG] == hashKey)
    if (workerByKey) {
      console.log(`Found worker by key: ${workerByKey.id}`)
      freeWorker(workerByKey.id)
      return workerByKey.id
    }

    throw new Error(`No worker found by key: ${key}`)
  }

  function makeid(length) {
    let result = ''
    const characters = 'abcdefghijklmnopqrstuvwxyz0123456789'
    const charactersLength = characters.length
    let counter = 0
    while (counter < length) {
      result += characters.charAt(Math.floor(Math.random() * charactersLength))
      counter += 1
    }
    return result
  }

  function makeidUnique(length, ids) {
    let id = makeid(length)
    while (ids.includes(id)) {
      id = makeid(length)
    }
    return id
  }

  function getKey() {
    let key = core.getInput('key')

    if (!key) {
      const pr = github.context.payload.pull_request
      if (!pr) throw new Error(`Key is required for operation 'get' when not running in a pull request context`)
      key = `${github.context.repo.owner}/${github.context.repo.repo}-${github.context.payload.pull_request.number}`
    }

    return key
  }


  const key = getKey()

  if (operation != 'get' && operation != 'free') {
    throw new Error(`Unknown operation: ${operation}. Expected 'allocate' or 'free'`)
  }

  if (operation == 'get') {
    const allowAllocate = core.getInput('allowAllocate') ?? true
    const folderId = await getWorker(allowAllocate, key)
    core.setOutput("folderId", folderId)
  } else if (operation == 'free' && freeFolderId == '') {
    core.setOutput("folderId", await freeWorkerByKey(key))
  } else if (operation == 'free' && freeFolderId != '') {
    core.setOutput("folderId", await freeWorker(freeFolderId))
  }

} catch (error) {
  if (error.details) core.setFailed(error.details)
  else if (error.message) core.setFailed(error.message)
  else core.setFailed(error)
}
