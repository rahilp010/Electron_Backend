const versionController = (req, res) => {
    res.json(
        {
            "version": '1.2.0',
            "url": "https://www.dropbox.com/scl/fi/8mw9v27gtihh5qwaeptf3/Electron-Release-v1.3.0.0.zip?rlkey=4ck0seegsb5l3krh2zurgv4yf&st=5jhapuj5&dl=1",
            "status": "success",
            "changeLog": "Added Version Update"
        }
    )
}

export default versionController
