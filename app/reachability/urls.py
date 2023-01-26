from django.urls import path
from .views import ViewListHosts, ViewHostDetail, ViewListHostTests

urlpatterns = [
    path('', ViewListHosts.as_view()),
    path('<int:id>', ViewHostDetail.as_view()),
    path('<int:id>/test', ViewListHostTests.as_view()),
]