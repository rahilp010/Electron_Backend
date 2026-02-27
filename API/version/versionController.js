const versionController = (req, res) => {
    res.json(
        {
            "version": '1.2.0',
            "url": "https://www.dropbox.com/scl/fi/42gj17a24f2wgm1ie3nxl/electron.exe?rlkey=798i6xnpza1oai8e9fxkqopfg&st=dqfk33yz&dl=1",
            "status": "success",
            "changeLog": "Added Version Update"
        }
    )
}

export default versionController
