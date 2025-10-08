const versionController = (req, res) => {
    res.json(
        {
            "version": '1.3.0',
            "url": "https://drive.google.com/uc?export=download&id=1k37wwKugnpEJ49I9io8GuD9_MxGPG7pT",
            "status": "success",
            "changeLog": "Added Version Update"
        }
    )
}

export default versionController
