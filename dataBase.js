const mongoose = require('mongoose')


const userScema = new mongoose.Schema({
    username: { type: String, required: true },
    log: [{
        description: String,
        duration: Number,
        date: String,
        _id: false,
    }]
});

const User = mongoose.model('fcc-tracker-User', userScema);

// Reset the database by deleting all entries
async function RefreshDatabase(Model) {
    await Model.deleteMany({});
}
// RefreshDatabase(User);

async function CreateOne(Model, query) {
    const newUser = new Model(query);
    await newUser.save();
    return newUser;
}
async function FindAll(Model) {
    const res = await Model.find({});
    return res;
}
async function FindOne(Model, query) {
    const res = await Model.findOne(query);
    return res;
}
async function FindOneAndUpdate(Model, filter, update) {
    const res = await Model.findOneAndUpdate(filter, update, {
        new: true, // return the document after update is applied
        // lean: true,// Returns the document as a plain JavaScript object rather than a mongoose document.
    });
    return res;
}
async function FindById(Model, id) {
    const res = await Model.findById(id);
    return res;
}
function FindByIdAndUpdate(Model, id, update, callback) {
    Model.findByIdAndUpdate(id,
        { $push: { log: update } },
        { new: true },
        callback,
    );
}


module.exports = { User, CreateOne, FindAll, FindOne, FindOneAndUpdate, FindById, FindByIdAndUpdate };