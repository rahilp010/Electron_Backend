const versionController = (req, res) => {
    res.json(
        {
            "version": '1.3.0',
            "url": "https://www.dropbox.com/scl/fi/5kn2cpi8yno52cm5r2vc5/Electron-Release-v1.3.0.0.zip?rlkey=73udd0yzg2qdo2g9uqpxnwk5u&st=jjw43qjs&dl=1",
            "status": "success",
            "changeLog": "Added Version Update"
        }
    )
}

export default versionController
