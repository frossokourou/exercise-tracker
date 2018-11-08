const express = require('express')
const app = express()
const bodyParser = require('body-parser')
const shortid = require('shortid');
const dotenv = require('dotenv').config();
const cors = require('cors')

const mongoose = require('mongoose')
mongoose.connect(process.env.MLAB_URI || 'mongodb://localhost/exercise-track', { useCreateIndex: true, useNewUrlParser: true } )

app.use(cors())

app.use(bodyParser.urlencoded({extended: false}))
app.use(bodyParser.json())

const Schema = mongoose.Schema;
const userToExerciseSchema = new Schema({
  user: {
    type: String,
    required: true,
    unique: true,
    dropDups: true
  },
  id: {
    type: String,
    required: true,
    default: shortid.generate,
    unique: true,
    dropDups: true
  },
  exercise: [{description: String, duration: Number, date: Date}]
});

const UserToExercise = mongoose.model('User', userToExerciseSchema);

app.use(express.static('public'))
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/views/index.html')
});


app.post('/api/exercise/new-user', (req, res) => {
  const userName = req.body.username;
  if (!userName) {
    return res.send('Enter your username');
  }
  UserToExercise.find({user: userName}, {lean: true}, (e, docs) => {
    if (e) {
      return res.send(e);
    }
    if (docs.length !== 0) {
      return res.send(`${userName} already taken`);
    }
    const user = new UserToExercise({
      user: userName,
      exercise: []
    });
    user.save((err, doc) => {
      if (err) {
        return res.send(err);
      }
      res.json({
        "user": userName,
        "id": user.id
      });
    });
  });
});


app.get('/api/exercise/users', (req, res) => {
  UserToExercise.find({}, {lean: true})
    .select({
      user: 1,
      id: 1,
      _id: 0
    })
    .sort({user: 1})
    .exec((err, users) => {
      if (err) {
        return res.send('Error while fetching users');
      }
      if (users.length === 0) {
        return res.send('No users yet');
      } else {
        res.send(users);
      }
  });
});


app.post('/api/exercise/add', (req, res) => {
  const id = req.body.userId;
  const description = req.body.description;
  const duration = req.body.duration;
  UserToExercise.findOne({id}, (err, user) => {
    if (err) {
      return res.send(err);
    }
    if (!user) {
      return res.send('User id does not exist');
    }
    if (!description) {
      return res.send('Exercise description missing');
    }
    if (!duration) {
      return res.send('Exercise duration missing');
    }

    const newDate = !req.body.date ? new Date() : new Date(req.body.date) ;
    const newExercise = {
      description: description,
      duration: duration,
      date: newDate
    };
    const exercises = user.exercise.concat([newExercise]);
    UserToExercise.updateOne({id}, {$set: {exercise: exercises}}, (error, rawResponse) => {
      if (error) {
        return res.send(error.reason.message);
      }
      // date = date.map((elem) => (elem.toISOString().slice(0,10)));
      res.json({user: user.user, id, exercise: newExercise});
    });
  });
});


app.get('/api/exercise/log/:id', (req, res) => {
  const idToFetch = req.params.id;
  UserToExercise.findOne({id: idToFetch}, {lean: true})
    .select({
      user: 1,
      id: 1,
      _id: 0,
      'exercise.description': 1,
      'exercise.duration': 1,
      'exercise.date': 1
    })
    .exec((err, user) => {
    if (err) {
      return res.send(err.message);
    }
    res.json({user: user.user, exercise: user.exercise, 'total exercise count': user.exercise.length});
  });
});


app.get('/api/exercise/log', (req, res) => {
  const fromDate = new Date(req.query.from);
  const toDate = new Date(req.query.to);
  const {id, from, to, limit} = req.query;
  console.log('******** from', from, 'to', to, 'limit', limit, 'id', id);

  UserToExercise.findOne({id: id})
    .select({
      user: 1,
      id: 1,
      _id: 0,
      'exercise.description': 1,
      'exercise.duration': 1,
      'exercise.date': 1
    })
    .sort({
      date: -1
    })
    .exec((err, user) => {
      if (err) {
        return res.send(err);
      }
      if (!user) {
        return res.send('You need to add a user id');
      }

      let exercises = user.exercise;
      if (from && !to) {
        console.log('1');
        exercises = exercises.filter((elem) => (
          elem.date >= fromDate
        ));
      }

      if (to && !from) {
        console.log('2');
        exercises = exercises.filter((el) => (
          el.date <= toDate
        ));
      }

      if (from && to) {
        console.log('3');
        exercises = exercises.filter((exer) => (
          exer.date >= fromDate && exer.date <= toDate
        ));
      }

      if (limit && limit < exercises.length) {
        exercises = exercises.slice(exercises.length - limit);
      }
      res.json({
        user: user.user,
        id: user.id,
        exercise: exercises,
        'exercise count': exercises.length
      });
    });
});



// Not found middleware
app.use((req, res, next) => {
  return next({status: 404, message: 'not found'})
})

// Error Handling middleware
app.use((err, req, res, next) => {
  let errCode, errMessage

  if (err.errors) {
    // mongoose validation error
    errCode = 400 // bad request
    const keys = Object.keys(err.errors)
    // report the first validation error
    errMessage = err.errors[keys[0]].message
  } else {
    // generic or custom error
    errCode = err.status || 500
    errMessage = err.message || 'Internal Server Error'
  }
  res.status(errCode).type('txt')
    .send(errMessage)
})

const listener = app.listen(process.env.PORT || 3000, () => {
  console.log('Your app is listening on port ' + listener.address().port)
})
