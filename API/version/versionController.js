const versionController = (req, res) => {
    res.json(
        {
            "version": '1.3.0',
            "url": "https://www.dropbox.com/scl/fi/bpvijyb0dbw8swaem07sw/Electron_Image_Release_v1.3.0.0.zip?rlkey=pzvvqi4yetnznzcdu49wmv0lt&st=elaylk01&dl=1",
            "status": "success",
            "changeLog": "Added Version Update"
        }
    )
}

export default versionController
