module.exports = {
    extends: "airbnb-base",
    rules: {
        indent: [
            "error",
            4,
            {
                "SwitchCase": 1
            },
        ],
        "no-underscore-dangle": [
            "error",
            {
                allow: [
                    "_id"
                ],
            },
        ],
    },
    env: {
        mocha: true,
    },
};
