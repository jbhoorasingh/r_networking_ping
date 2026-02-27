from django.urls import path
from .views import (
    ViewListHosts,
    ViewHostDetail,
    ViewListHostTests,
    ViewListTests,
)

urlpatterns = [
    path('host/', ViewListHosts.as_view()),
    path('host/<int:id>', ViewHostDetail.as_view()),
    path('host/<int:id>/test', ViewListHostTests.as_view()),
    path('test/', ViewListTests.as_view()),
]
